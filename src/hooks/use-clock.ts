import * as React from "react"

// A single ticking clock shared by every component that needs "how old is this
// sample". Reading `Date.now()` during render is impure and re-renders would
// silently disagree with each other; subscribing to one store keeps freshness
// checks consistent and re-renders them on a schedule.

const TICK_MS = 15_000

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

const getSnapshot = () => current

/** Milliseconds since the epoch, refreshed every 15 seconds. */
export function useClock(): number {
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
