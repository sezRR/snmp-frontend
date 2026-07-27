import * as React from "react"

// A single ticking clock shared by every component that needs "how long ago".
// Reading `Date.now()` during render is impure and re-renders would silently
// disagree with each other; subscribing to one store keeps elapsed times
// consistent and counting.

const TICK_MS = 1000

/** Freshness checks only change on the minute scale. */
export const COARSE_RESOLUTION_MS = 15_000

let current = Date.now()
let timer: ReturnType<typeof setInterval> | undefined
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  timer ??= setInterval(() => {
    current = Date.now()
    for (const entry of listeners) entry()
  }, TICK_MS)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      clearInterval(timer)
      timer = undefined
    }
  }
}

/**
 * Milliseconds since the epoch, rounded down to `resolutionMs`. The ticker runs
 * every second, but a subscriber reading at a coarser resolution gets an
 * unchanged number in between and React skips its re-render — so a per-second
 * counter and a 15-second staleness check can share one interval.
 */
export function useClock(resolutionMs: number = COARSE_RESOLUTION_MS): number {
  const getSnapshot = React.useCallback(
    () => Math.floor(current / resolutionMs) * resolutionMs,
    [resolutionMs]
  )
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
