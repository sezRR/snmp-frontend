import * as React from "react"

export type Reachability =
  | "ok"
  | "suspect"
  | "down"

let state: Reachability = "ok"
const listeners = new Set<() => void>()

function set(next: Reachability): void {
  if (state === next) return
  state = next
  for (const listener of listeners) listener()
}

export function reportReachable(): void {
  set("ok")
}

export function reportUnreachable(): void {
  if (state === "ok") set("suspect")
}

export function confirmUnreachable(): void {
  set("down")
}

const GATEWAY_FAILURES = new Set([502, 503, 504])

export function reportResponseStatus(status: number): void {
  if (GATEWAY_FAILURES.has(status)) reportUnreachable()
  else reportReachable()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getSnapshot = (): Reachability => state

export function useReachability(): Reachability {
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
