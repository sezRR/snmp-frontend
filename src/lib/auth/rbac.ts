import type { Me } from "@/lib/api/types"
import type { Scope } from "@/lib/auth/scopes"
import { meQueryOptions } from "@/lib/queries/auth"
import type { QueryClient } from "@tanstack/react-query"
import { useQuery } from "@tanstack/react-query"
import * as React from "react"

export interface AuthContext {
  readonly user: Me | null
  hasRole: (role: string) => boolean
  hasAnyRole: (roles: readonly string[]) => boolean
  hasAllRoles: (roles: readonly string[]) => boolean
  hasScope: (scope: Scope) => boolean
  hasAnyScope: (scopes: readonly Scope[]) => boolean
  hasAllScopes: (scopes: readonly Scope[]) => boolean
}

export interface AccessRule {
  roles?: readonly string[]
  scopes?: readonly Scope[]
  requireAll?: boolean
}

export type DenialReason = "insufficient_role" | "insufficient_scope"

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

export function createRouterAuth(queryClient: QueryClient): AuthContext {
  return createAuth(
    () => queryClient.getQueryData(meQueryOptions().queryKey) ?? null
  )
}

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

export function allows(auth: AuthContext, rule: AccessRule): boolean {
  return denialReason(auth, rule) === null
}

export function useAuth(): AuthContext {
  const { data } = useQuery(meQueryOptions())
  const me = data ?? null
  return React.useMemo(() => createAuth(() => me), [me])
}

export function useHasScope(scope: Scope): boolean {
  return useAuth().hasScope(scope)
}

export function useHasRole(role: string): boolean {
  return useAuth().hasRole(role)
}

export function useAllows(rule: AccessRule): boolean {
  return allows(useAuth(), rule)
}
