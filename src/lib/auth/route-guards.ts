import { ApiError } from "@/lib/api/client"
import {
  type AccessRule,
  type AuthContext,
  denialReason,
} from "@/lib/auth/rbac"
import { sanitizeReturnTo } from "@/lib/auth/search"
import { hasSession } from "@/lib/auth/session"
import { meQueryOptions } from "@/lib/queries/auth"
import type { QueryClient } from "@tanstack/react-query"
import { redirect } from "@tanstack/react-router"

interface GuardArgs {
  context: { queryClient: QueryClient; auth: AuthContext }
  location: { href: string }
}

export function requireSession({ location }: GuardArgs): void {
  if (!hasSession()) {
    throw redirect({
      to: "/login",
      search: { redirect: sanitizeReturnTo(location.href) },
    })
  }
}

export function requireAccess(rule: AccessRule) {
  return async (args: GuardArgs): Promise<void> => {
    const { context, location } = args
    await refreshIdentity(context.queryClient, location.href)

    const reason = denialReason(context.auth, rule)
    if (reason) {
      throw redirect({
        to: "/unauthorized",
        search: { redirect: sanitizeReturnTo(location.href), reason },
      })
    }
  }
}

async function refreshIdentity(
  queryClient: QueryClient,
  redirectHref: string
): Promise<void> {
  try {
    await queryClient.fetchQuery({ ...meQueryOptions(), staleTime: 0 })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      throw redirect({
        to: "/login",
        search: { redirect: sanitizeReturnTo(redirectHref) },
      })
    }
    throw error
  }
}
