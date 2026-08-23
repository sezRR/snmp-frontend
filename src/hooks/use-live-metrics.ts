import { fleetStreamUrl, machineStreamUrl } from "@/lib/api/sse"
import { type MetricSample, metricSampleSchema } from "@/lib/api/types"
import * as React from "react"

export type LiveStatus = "connecting" | "open" | "reconnecting" | "error"

const MAX_BACKOFF_MS = 30_000
const HIDDEN_CLOSE_DELAY_MS = 30_000
const MAX_HISTORY = 180

const SAMPLE_EVENTS = ["metric", "metrics", "sample"]

const REVOKED_EVENT = "session-revoked"

interface StreamSnapshot<S> {
  data: S
  status: LiveStatus
}

interface StreamStore<S> {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => StreamSnapshot<S>
}

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

  const handleRevoked = (mine: number) => {
    if (mine !== generation) return
    source?.close()
    source = null
    attempt = 0
    connect()
  }

  const open = (url: string, mine: number) => {
    source = new EventSource(url)
    source.onopen = () => {
      attempt = 0
      emit({ status: "open" })
    }
    for (const name of SAMPLE_EVENTS) source.addEventListener(name, handleEvent)
    source.addEventListener(REVOKED_EVENT, () => handleRevoked(mine))
    source.onmessage = handleEvent
    source.onerror = () => {
      if (mine !== generation) return
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
