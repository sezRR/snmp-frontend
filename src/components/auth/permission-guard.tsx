import { type AccessRule, allows, useAuth } from "@/lib/auth/rbac"
import { sanitizeReturnTo } from "@/lib/auth/search"
import {
  useLocation,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router"
import * as React from "react"

interface PermissionGuardProps extends AccessRule {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function PermissionGuard({
  children,
  fallback = null,
  ...rule
}: PermissionGuardProps) {
  const auth = useAuth()
  return <>{allows(auth, rule) ? children : fallback}</>
}

export function AccessDeniedRedirect({
  reason = "insufficient_scope",
}: {
  reason?: "insufficient_role" | "insufficient_scope"
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const routerIsLoading = useRouterState({ select: (state) => state.isLoading })
  const redirectStarted = React.useRef(false)
  // Keep the attempted location stable while the router transitions to the
  // guard page, so /unauthorized cannot become its own return target.
  const [attempted] = React.useState(() => sanitizeReturnTo(location.href))

  React.useEffect(() => {
    // Let the destination's route guard decide against its refreshed identity.
    if (routerIsLoading) return
    if (redirectStarted.current) return

    redirectStarted.current = true
    void navigate({
      to: "/unauthorized",
      search: { redirect: attempted, reason },
      replace: true,
    })
  }, [attempted, navigate, reason, routerIsLoading])

  return null
}
