import { buildLiveUrl } from "@/lib/api/sse"
import { type LiveMetrics, liveMetricsSchema } from "@/lib/api/types"
import * as React from "react"

export type LiveStatus = "connecting" | "open" | "reconnecting" | "error"

export interface LiveMetricsSnapshot {
  latest: LiveMetrics | null
  history: LiveMetrics[]
  status: LiveStatus
}

const MAX_BACKOFF_MS = 30_000
const HIDDEN_CLOSE_DELAY_MS = 30_000

const EMPTY_SNAPSHOT: LiveMetricsSnapshot = {
  latest: null,
  history: [],
  status: "connecting",
}

// External store wrapping one EventSource per subscribed worker. The stream
// opens on the first subscriber and closes on the last, which also makes
// StrictMode's double-invoked subscriptions safe.
function createLiveMetricsStore(workerId: string, windowSize: number) {
  let snapshot = EMPTY_SNAPSHOT
  const listeners = new Set<() => void>()

  let source: EventSource | null = null
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let hiddenTimer: ReturnType<typeof setTimeout> | undefined
  let attempt = 0

  const emit = (patch: Partial<LiveMetricsSnapshot>) => {
    snapshot = { ...snapshot, ...patch }
    for (const listener of listeners) listener()
  }

  const handleEvent = (event: MessageEvent) => {
    let metrics: LiveMetrics
    try {
      metrics = liveMetricsSchema.parse(JSON.parse(event.data as string))
    } catch {
      return
    }
    emit({
      latest: metrics,
      history: [...snapshot.history.slice(-(windowSize - 1)), metrics],
    })
  }

  const connect = () => {
    source = new EventSource(buildLiveUrl(workerId))
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
    snapshot = EMPTY_SNAPSHOT
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

const noopSubscribe = () => () => {}
const getEmptySnapshot = () => EMPTY_SNAPSHOT

interface UseLiveMetricsOptions {
  windowSize?: number
  enabled?: boolean
}

export function useLiveMetrics(
  workerId: string,
  { windowSize = 60, enabled = true }: UseLiveMetricsOptions = {}
): LiveMetricsSnapshot {
  const store = React.useMemo(
    () => (enabled ? createLiveMetricsStore(workerId, windowSize) : null),
    [workerId, windowSize, enabled]
  )

  return React.useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    store?.getSnapshot ?? getEmptySnapshot
  )
}
