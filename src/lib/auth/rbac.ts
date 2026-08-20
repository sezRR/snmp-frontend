import type { Me } from "@/lib/api/types"
import type { Scope } from "@/lib/auth/scopes"
import { meQueryOptions } from "@/lib/queries/auth"
import type { QueryClient } from "@tanstack/react-query"
import { useQuery } from "@tanstack/react-query"
import * as React from "react"

// Who is signed in, and what they are allowed to do. One shape answers that for
// both halves of the application: the router, which decides before a page
// exists, and the components, which decide what to render once it does.
//
// The answer comes from /auth/me rather than from the token, because the
// backend reads it from the database — a role edited a minute ago is already
// reflected here, while the token still carries whatever was true when it was
// issued.

/**
 * The signed-in account's identity and permissions, in the form the router
 * context and `useAuth` both hand out.
 *
 * Every predicate answers `false` for a signed-out or not-yet-loaded user, so a
 * gate never has to special-case "we don't know yet" — an unknown user is
 * treated as one who may do nothing, which is the safe way round.
 */
export interface AuthContext {
  /** The account as last read, or null when signed out or still loading. */
  readonly user: Me | null
  hasRole: (role: string) => boolean
  hasAnyRole: (roles: readonly string[]) => boolean
  hasAllRoles: (roles: readonly string[]) => boolean
  hasScope: (scope: Scope) => boolean
  hasAnyScope: (scopes: readonly Scope[]) => boolean
  hasAllScopes: (scopes: readonly Scope[]) => boolean
}

/**
 * What a route or a control demands of its user. An empty rule allows
 * everyone; a rule that names both roles and scopes demands both.
 */
export interface AccessRule {
  /** Any one of these role names is enough, unless `requireAll`. */
  roles?: readonly string[]
  /** Any one of these scopes is enough, unless `requireAll`. */
  scopes?: readonly Scope[]
  /** Demand every role and every scope listed rather than any one of them. */
  requireAll?: boolean
}

/** Why access was refused — the wording the unauthorized page explains. */
export type DenialReason = "insufficient_role" | "insufficient_scope"

/**
 * Builds the predicates over a thunk rather than a snapshot, so the router's
 * copy can stay a single long-lived object that reads whatever /auth/me last
 * returned instead of a value frozen at router-creation time.
 */
export function createAuth(read: () => Me | null): AuthContext {
  const roles = () => read()?.roles ?? []
  const scopes = () => read()?.scopes ?? []

  return {
    get user() {
      return read()
    },
    hasRole: (role) => roles().includes(role),
    hasAnyRole: (list) => list.some((role) => roles().includes(role)),
    hasAllRoles: (list) => list.every((role) => roles().includes(role)),
    hasScope: (scope) => scopes().includes(scope),
    hasAnyScope: (list) => list.some((scope) => scopes().includes(scope)),
    hasAllScopes: (list) => list.every((scope) => scopes().includes(scope)),
  }
}

/**
 * The router's copy, handed to `createRouter` as context so `beforeLoad` can
 * ask about permissions without reaching for a React hook it has no access to.
 *
 * It reads the cache rather than fetching: guards that need a *current* answer
 * refresh the query first (see `auth/route-guards`), and everything else is
 * happy with the copy the authenticated layout's loader already resolved.
 */
export function createRouterAuth(queryClient: QueryClient): AuthContext {
  return createAuth(
    () => queryClient.getQueryData(meQueryOptions().queryKey) ?? null
  )
}

/** Why `auth` fails `rule`, or null when it passes. */
export function denialReason(
  auth: AuthContext,
  { roles = [], scopes = [], requireAll = false }: AccessRule
): DenialReason | null {
  const rolesOk =
    roles.length === 0 ||
    (requireAll ? auth.hasAllRoles(roles) : auth.hasAnyRole(roles))
  if (!rolesOk) return "insufficient_role"

  const scopesOk =
    scopes.length === 0 ||
    (requireAll ? auth.hasAllScopes(scopes) : auth.hasAnyScope(scopes))
  if (!scopesOk) return "insufficient_scope"

  return null
}

/** The one predicate the guards, the sidebar and `PermissionGuard` share. */
export function allows(auth: AuthContext, rule: AccessRule): boolean {
  return denialReason(auth, rule) === null
}

/**
 * The component-side view of the same context.
 *
 * Backed by the query, so a role change, a sign-out in another tab or the
 * layout's loader resolving all re-render the gates rather than leaving a
 * button that was drawn against a stale answer. Memoised because a permission
 * check is asked several times per render in the busier pages, and because an
 * identity that has not changed should not hand out a new object.
 */
export function useAuth(): AuthContext {
  const { data } = useQuery(meQueryOptions())
  const me = data ?? null
  return React.useMemo(() => createAuth(() => me), [me])
}

/**
 * Whether the UI should offer an action. The backend enforces the same rule —
 * this only decides whether a user is shown a button that would 403.
 */
export function useHasScope(scope: Scope): boolean {
  return useAuth().hasScope(scope)
}

/** As `useHasScope`, for the rare gate that is about identity, not ability. */
export function useHasRole(role: string): boolean {
  return useAuth().hasRole(role)
}

/** Whether the signed-in user satisfies a whole rule. */
export function useAllows(rule: AccessRule): boolean {
  return allows(useAuth(), rule)
}
