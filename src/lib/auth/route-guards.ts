import { ApiError } from "@/lib/api/client"
import type { Me } from "@/lib/api/types"
import type { Scope } from "@/lib/auth/scopes"
import { meQueryOptions } from "@/lib/queries/auth"
import type { QueryClient } from "@tanstack/react-query"
import { redirect } from "@tanstack/react-router"

export async function requireRouteScope(
  queryClient: QueryClient,
  scope: Scope,
  redirectHref: string
): Promise<Me> {
  let me: Me
  try {
    me = await queryClient.fetchQuery({ ...meQueryOptions(), staleTime: 0 })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      throw redirect({ to: "/login", search: { redirect: redirectHref } })
    }
    throw error
  }
  if (!me.scopes.includes(scope)) throw redirect({ to: "/" })
  return me
}
