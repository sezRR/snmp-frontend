import { type AccessRule, allows, useAuth } from "@/lib/auth/rbac"
import { Navigate, useLocation } from "@tanstack/react-router"
import type * as React from "react"

// The component-side counterpart to the route guards. Same rules, same
// vocabulary; the difference is only what refusal looks like — a control that
// is never drawn, rather than a page that is never entered.
//
// Neither of these is a security boundary. The backend rejects a request the
// caller has no scope for whatever the UI drew; hiding the control only spares
// the user a button that would answer 403.

interface PermissionGuardProps extends AccessRule {
  children: React.ReactNode
  /** Shown instead when the rule fails. Nothing, by default. */
  fallback?: React.ReactNode
}

/**
 * Renders `children` only for a user who satisfies the rule.
 *
 * ```tsx
 * <PermissionGuard scopes={[SCOPES.usersWrite]} fallback={<ReadOnlyNote />}>
 *   <Button>Create user</Button>
 * </PermissionGuard>
 * ```
 *
 * Worth reaching for when the gated markup is a block. A single `disabled` or a
 * one-line conditional is still better written with `useHasScope`, which says
 * the same thing without a wrapper in the tree.
 */
export function PermissionGuard({
  children,
  fallback = null,
  ...rule
}: PermissionGuardProps) {
  const auth = useAuth()
  return <>{allows(auth, rule) ? children : fallback}</>
}

/**
 * The in-page half of a route guard, for permissions lost while the page is
 * already mounted — a role edited in another tab, or by an administrator.
 *
 * The `beforeLoad` guard only runs on the way in, so a page whose scope can be
 * revoked underneath it needs this as well. It renders nothing; it navigates.
 */
export function AccessDeniedRedirect({
  reason = "insufficient_scope",
}: {
  reason?: "insufficient_role" | "insufficient_scope"
}) {
  const location = useLocation()
  return (
    <Navigate
      to="/unauthorized"
      search={{ redirect: location.href, reason }}
      replace
    />
  )
}
