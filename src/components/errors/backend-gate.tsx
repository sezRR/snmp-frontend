import { BackendDownScreen } from "@/components/errors/error-screen"
import { useReachability } from "@/lib/api/reachability"
import {
  BackendUnreachableError,
  healthEndpoint,
  useBackendHealth,
} from "@/lib/queries/health"
import { useRouter } from "@tanstack/react-router"
import * as React from "react"

interface Recovery {
  blocking: boolean
}

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
  const router = useRouter()
  const [previousReachability, setPreviousReachability] =
    React.useState(reachability)
  const [recovery, setRecovery] = React.useState<Recovery | null>(null)
  const recoveryInFlight = React.useRef<Recovery | null>(null)

  if (previousReachability !== reachability) {
    setPreviousReachability(reachability)
    if (previousReachability !== "ok" && reachability === "ok") {
      setRecovery((current) => ({
        blocking: previousReachability === "down" || !!current?.blocking,
      }))
    }
  }

  React.useLayoutEffect(() => {
    if (!recovery || recoveryInFlight.current) return

    // A loader may have put its route match into an error state before the
    // health probe confirmed the outage. Invalidation retries that loader and
    // resets the route boundary as one operation.
    const currentRecovery = recovery
    recoveryInFlight.current = currentRecovery
    const finish = () => {
      recoveryInFlight.current = null
      setRecovery((current) => {
        if (current === currentRecovery) return null
        // Coalesce transitions received during this reload into one retry.
        return current ? { ...current } : null
      })
    }
    void router.invalidate({ sync: true }).then(finish, finish)
  }, [recovery, router])

  if (reachability !== "down" && !recovery?.blocking) return children

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
      busy={health.isFetching || recovery !== null}
      onRetry={() => void health.refetch()}
    />
  )
}
