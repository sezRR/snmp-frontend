import { fleetStreamUrl, machineStreamUrl } from "@/lib/api/sse"
import { type MetricSample, metricSampleSchema } from "@/lib/api/types"
import * as React from "react"

export type LiveStatus = "connecting" | "open" | "reconnecting" | "error"

const MAX_BACKOFF_MS = 30_000
const HIDDEN_CLOSE_DELAY_MS = 30_000
/** Enough tail to redraw a 15-minute window at a 5s poll interval. */
const MAX_HISTORY = 180

interface StreamSnapshot<S> {
  data: S
  status: LiveStatus
}

interface StreamStore<S> {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => StreamSnapshot<S>
}

// One EventSource per stream URL, shared by every subscriber: the stream opens
// on the first subscriber and closes on the last, which also makes StrictMode's
// double-invoked subscriptions safe and keeps a dashboard of N cards on a
// single connection instead of N.
function createSampleStream<S>(
  url: string,
  initial: S,
  reduce: (state: S, sample: MetricSample) => S
): StreamStore<S> {
  let snapshot: StreamSnapshot<S> = { data: initial, status: "connecting" }
  const listeners = new Set<() => void>()

  let source: EventSource | null = null
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let hiddenTimer: ReturnType<typeof setTimeout> | undefined
  let attempt = 0

  const emit = (patch: Partial<StreamSnapshot<S>>) => {
    snapshot = { ...snapshot, ...patch }
    for (const listener of listeners) listener()
  }

  const handleEvent = (event: MessageEvent) => {
    const parsed = metricSampleSchema.safeParse(
      JSON.parse(event.data as string)
    )
    if (!parsed.success) return
    emit({ data: reduce(snapshot.data, parsed.data) })
  }

  const connect = () => {
    source = new EventSource(url)
    emit({ status: attempt === 0 ? "connecting" : "reconnecting" })
    source.onopen = () => {
      attempt = 0
      emit({ status: "open" })
    }
    // Named event from FastAPI, plus unnamed-event fallback
    source.addEventListener("metrics", handleEvent)
    source.onmessage = handleEvent
    source.onerror = () => {
      // EventSource retries transient drops itself; only when the browser
      // gives up (CLOSED) do we recreate it, with capped backoff.
      if (source?.readyState === EventSource.CLOSED) {
        source.close()
        attempt += 1
        emit({ status: attempt > 3 ? "error" : "reconnecting" })
        retryTimer = setTimeout(
          connect,
          Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt)
        )
      } else {
        emit({ status: "reconnecting" })
      }
    }
  }

  const handleVisibility = () => {
    if (document.hidden) {
      hiddenTimer = setTimeout(() => {
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
    document.removeEventListener("visibilitychange", handleVisibility)
    source?.close()
    source = null
    snapshot = { data: initial, status: "connecting" }
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
    fleetStreamUrl(),
    EMPTY_FLEET,
    (state, sample) => ({ ...state, [sample.mac]: sample })
  )
  return fleetStore
}

function getMachineStore(mac: string): StreamStore<MachineState> {
  let store = machineStores.get(mac)
  if (!store) {
    store = createSampleStream(
      machineStreamUrl(mac),
      EMPTY_MACHINE,
      (state, sample) => ({
        latest: sample,
        history: [...state.history.slice(-(MAX_HISTORY - 1)), sample],
      })
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
