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

    const currentRecovery = recovery
    recoveryInFlight.current = currentRecovery
    const finish = () => {
      recoveryInFlight.current = null
      setRecovery((current) => {
        if (current === currentRecovery) return null
        return current ? { ...current } : null
      })
    }
    void router.invalidate({ sync: true }).then(finish, finish)
  }, [recovery, router])

  if (reachability !== "down" && !recovery?.blocking) return children

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
