import { meQueryOptions } from "@/lib/queries/auth"
import { useQuery } from "@tanstack/react-query"

// The permission vocabulary, fixed in the backend's code and served by
// /scopes. Naming it here keeps a typo in a gate from silently hiding a button
// forever, since an unknown string would never be held by anyone.

export const SCOPES = {
  machinesRead: "machines:read",
  machinesWrite: "machines:write",
  metricsRead: "metrics:read",
  metricsWrite: "metrics:write",
  adminRead: "admin:read",
  adminWrite: "admin:write",
  usersRead: "users:read",
  usersWrite: "users:write",
  rolesRead: "roles:read",
  rolesWrite: "roles:write",
  credentialsRead: "credentials:read",
  credentialsWrite: "credentials:write",
} as const

export type Scope = (typeof SCOPES)[keyof typeof SCOPES]

/**
 * The caller's effective scopes — the union of the roles they hold.
 *
 * Empty while `/auth/me` is in flight, which reads as "no permissions" and so
 * hides the write actions. The authenticated layout resolves the query in its
 * loader for exactly that reason: by the time a page renders, this is the
 * user's real answer rather than a momentary no.
 */
export function useScopes(): string[] {
  const { data } = useQuery(meQueryOptions())
  return data?.scopes ?? []
}

/**
 * Whether the UI should offer an action. The backend enforces the same rule —
 * this only decides whether a user is shown a button that would 403.
 */
export function useHasScope(scope: Scope): boolean {
  return useScopes().includes(scope)
}
