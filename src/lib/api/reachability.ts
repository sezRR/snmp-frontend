import * as React from "react"

// Whether the API is answering at all — a different question from whether a
// particular request succeeded. A 404 or a 403 is a healthy backend saying no;
// a request that never gets an answer, or a gateway status the API itself could
// not have produced, is the backend being gone.
//
// Two steps rather than one, because a single failed request is a bad reason to
// replace the whole application with an error page: a request layer that cannot
// reach the API raises a suspicion, and only the `/healthz` probe in
// `@/lib/queries/health` is allowed to confirm it.

export type Reachability =
  /** Something answered recently. */
  | "ok"
  /** A request went unanswered; the probe has not ruled yet. */
  | "suspect"
  /** The probe asked `/healthz` too and got nothing usable back. */
  | "down"

let state: Reachability = "ok"
const listeners = new Set<() => void>()

function set(next: Reachability): void {
  if (state === next) return
  state = next
  for (const listener of listeners) listener()
}

/** Any completed response, of any status, proves the API is there. */
export function reportReachable(): void {
  set("ok")
}

/**
 * A request that never arrived, or came back as a gateway failure the API
 * itself could not have written. Only ever a suspicion: it does not overrule a
 * probe that has already confirmed the backend is down.
 */
export function reportUnreachable(): void {
  if (state === "ok") set("suspect")
}

/** The `/healthz` probe failed as well — no longer a guess. */
export function confirmUnreachable(): void {
  set("down")
}

/** Statuses only a proxy in front of a missing backend produces. */
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
