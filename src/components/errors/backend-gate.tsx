import { BackendDownScreen } from "@/components/errors/error-screen"
import { useReachability } from "@/lib/api/reachability"
import {
  BackendUnreachableError,
  healthEndpoint,
  useBackendHealth,
} from "@/lib/queries/health"
import type * as React from "react"

/**
 * Replaces the application with the offline screen while the API is confirmed
 * gone, and takes it away again by itself.
 *
 * It sits above the router's outlet rather than on a route of its own, which
 * keeps the address bar pointing at wherever the user actually was: when the
 * backend comes back there is nothing to navigate back to, the page they were
 * reading simply returns. It also covers the sign-in page, where a dead backend
 * would otherwise only be discovered by typing a password and waiting.
 *
 * Only `down` — a failed request *and* a failed `/healthz` probe — hides the
 * app. A single unanswered request is a blip, and blanking a dashboard over one
 * is worse than the blip.
 */
export function BackendGate({ children }: { children: React.ReactNode }) {
  const reachability = useReachability()
  const health = useBackendHealth()

  if (reachability !== "down") return children

  // The status separates "nothing answered" from "answered, and badly", which
  // are different failures with different fixes.
  const status =
    health.error instanceof BackendUnreachableError ? health.error.status : 0

  const detail =
    health.error instanceof BackendUnreachableError
      ? `GET ${healthEndpoint()} -> ${status > 0 ? status : "no response"}`
      : (health.error?.message ?? null)

  return (
    <BackendDownScreen
      status={status}
      detail={detail}
      busy={health.isFetching}
      onRetry={() => void health.refetch()}
    />
  )
}
