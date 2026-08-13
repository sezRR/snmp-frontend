import { fleetStreamUrl, machineStreamUrl } from "@/lib/api/sse"
import { type MetricSample, metricSampleSchema } from "@/lib/api/types"
import * as React from "react"

export type LiveStatus = "connecting" | "open" | "reconnecting" | "error"

const MAX_BACKOFF_MS = 30_000
const HIDDEN_CLOSE_DELAY_MS = 30_000
/** Enough tail to redraw a 15-minute window at a 5s poll interval. */
const MAX_HISTORY = 180

// The stream names its sample events; `onmessage` alone would miss them, since
// it only fires for events with no name at all. The backend currently sends
// `metric`, and the others are accepted so a rename does not go dark.
const SAMPLE_EVENTS = ["metric", "metrics", "sample"]

interface StreamSnapshot<S> {
  data: S
  status: LiveStatus
}

interface StreamStore<S> {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => StreamSnapshot<S>
}

// One EventSource per stream, shared by every subscriber: the stream opens on
// the first subscriber and closes on the last, which also makes StrictMode's
// double-invoked subscriptions safe and keeps a dashboard of N cards on a
// single connection instead of N.
//
// The URL is resolved per connection rather than passed in, because it carries
// a single-use stream ticket: replaying the last one would be refused.
function createSampleStream<S>(
  resolveUrl: () => Promise<string>,
  initial: S,
  reduce: (state: S, sample: MetricSample) => S,
  onStop?: () => void
): StreamStore<S> {
  let snapshot: StreamSnapshot<S> = { data: initial, status: "connecting" }
  const listeners = new Set<() => void>()

  let source: EventSource | null = null
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let hiddenTimer: ReturnType<typeof setTimeout> | undefined
  let attempt = 0
  // Bumped by every connect and by stop, so a ticket still in flight when the
  // stream is torn down or superseded cannot open a connection nobody wants.
  let generation = 0

  const emit = (patch: Partial<StreamSnapshot<S>>) => {
    snapshot = { ...snapshot, ...patch }
    for (const listener of listeners) listener()
  }

  const handleEvent = (event: MessageEvent) => {
    let payload: unknown
    try {
      payload = JSON.parse(event.data as string)
    } catch {
      return
    }
    const parsed = metricSampleSchema.safeParse(payload)
    if (!parsed.success) return
    emit({ data: reduce(snapshot.data, parsed.data) })
  }

  const scheduleRetry = () => {
    attempt += 1
    emit({ status: attempt > 3 ? "error" : "reconnecting" })
    retryTimer = setTimeout(
      connect,
      Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt)
    )
  }

  const open = (url: string, mine: number) => {
    source = new EventSource(url)
    source.onopen = () => {
      attempt = 0
      emit({ status: "open" })
    }
    // Named events from FastAPI, plus the unnamed-event fallback. The stream's
    // own `connected` event is left alone: it fails the sample schema and is
    // dropped by handleEvent.
    for (const name of SAMPLE_EVENTS) source.addEventListener(name, handleEvent)
    source.onmessage = handleEvent
    source.onerror = () => {
      if (mine !== generation) return
      // EventSource retries transient drops itself; only when the browser
      // gives up (CLOSED) do we recreate it, with capped backoff. Its own
      // retry would replay a spent ticket, so a fresh connect is the only way
      // back anyway.
      if (source?.readyState === EventSource.CLOSED) {
        source.close()
        source = null
        scheduleRetry()
      } else {
        emit({ status: "reconnecting" })
      }
    }
  }

  const connect = () => {
    const mine = ++generation
    emit({ status: attempt === 0 ? "connecting" : "reconnecting" })
    void resolveUrl().then(
      (url) => {
        if (mine === generation) open(url, mine)
      },
      () => {
        // No ticket, no stream — the session may have lapsed, or the backend
        // is down. Either way the retry is the same one a dropped connection
        // gets, so a stream left open across a refresh recovers on its own.
        if (mine === generation) scheduleRetry()
      }
    )
  }

  const handleVisibility = () => {
    if (document.hidden) {
      hiddenTimer = setTimeout(() => {
        generation += 1
        source?.close()
        source = null
      }, HIDDEN_CLOSE_DELAY_MS)
    } else {
      clearTimeout(hiddenTimer)
      if (!source || source.readyState === EventSource.CLOSED) {
        attempt = 0
        connect()
      }
    }
  }

  const stop = () => {
    clearTimeout(retryTimer)
    clearTimeout(hiddenTimer)
    generation += 1
    document.removeEventListener("visibilitychange", handleVisibility)
    source?.close()
    source = null
    // Leaving the page discards the tail: coming back starts a fresh window
    // rather than resuming one the user never watched fill.
    snapshot = { data: initial, status: "connecting" }
    onStop?.()
  }

  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      if (listeners.size === 1) {
        document.addEventListener("visibilitychange", handleVisibility)
        connect()
      }
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) stop()
      }
    },
    getSnapshot: () => snapshot,
  }
}

type FleetState = Record<string, MetricSample>
type MachineState = { latest: MetricSample | null; history: MetricSample[] }

const EMPTY_FLEET: FleetState = {}
const EMPTY_MACHINE: MachineState = { latest: null, history: [] }

// Stores outlive individual components so remounts reuse a warm connection
// and its accumulated history.
const machineStores = new Map<string, StreamStore<MachineState>>()
let fleetStore: StreamStore<FleetState> | null = null

function getFleetStore(): StreamStore<FleetState> {
  fleetStore ??= createSampleStream(
    () => fleetStreamUrl(),
    EMPTY_FLEET,
    (state, sample) => ({ ...state, [sample.mac]: sample })
  )
  return fleetStore
}

function getMachineStore(mac: string): StreamStore<MachineState> {
  let store = machineStores.get(mac)
  if (!store) {
    store = createSampleStream(
      () => machineStreamUrl(mac),
      EMPTY_MACHINE,
      (state, sample) => ({
        latest: sample,
        history: [...state.history.slice(-(MAX_HISTORY - 1)), sample],
      }),
      () => machineStores.delete(mac)
    )
    machineStores.set(mac, store)
  }
  return store
}

const noopSubscribe = () => () => {}

export interface MachineLiveMetrics extends MachineState {
  status: LiveStatus
}

export function useMachineLiveMetrics(
  mac: string,
  { enabled = true }: { enabled?: boolean } = {}
): MachineLiveMetrics {
  const store = enabled ? getMachineStore(mac) : null
  const snapshot = React.useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    store?.getSnapshot ?? getEmptyMachineSnapshot
  )
  return { ...snapshot.data, status: snapshot.status }
}

export interface FleetLiveMetrics {
  byMac: FleetState
  status: LiveStatus
}

/** Every machine's newest sample over one connection, keyed by MAC. */
export function useFleetLiveMetrics({
  enabled = true,
}: { enabled?: boolean } = {}): FleetLiveMetrics {
  const store = enabled ? getFleetStore() : null
  const snapshot = React.useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    store?.getSnapshot ?? getEmptyFleetSnapshot
  )
  return { byMac: snapshot.data, status: snapshot.status }
}

const EMPTY_MACHINE_SNAPSHOT: StreamSnapshot<MachineState> = {
  data: EMPTY_MACHINE,
  status: "connecting",
}
const EMPTY_FLEET_SNAPSHOT: StreamSnapshot<FleetState> = {
  data: EMPTY_FLEET,
  status: "connecting",
}
const getEmptyMachineSnapshot = () => EMPTY_MACHINE_SNAPSHOT
const getEmptyFleetSnapshot = () => EMPTY_FLEET_SNAPSHOT
