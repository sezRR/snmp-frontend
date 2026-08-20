import { ApiError } from "@/lib/api/client"
import {
  type AccessRule,
  type AuthContext,
  denialReason,
} from "@/lib/auth/rbac"
import { hasSession } from "@/lib/auth/session"
import { meQueryOptions } from "@/lib/queries/auth"
import type { QueryClient } from "@tanstack/react-query"
import { redirect } from "@tanstack/react-router"

// The routing half of access control: the same rules `auth/rbac` uses to hide a
// button, applied before a page is allowed to load at all.
//
// Two refusals, and they are different: no session at all is a trip to /login
// with somewhere to come back to, while a session that simply does not hold the
// permission is a trip to /unauthorized. Sending the second case to the login
// page would be a lie — signing in again changes nothing.

/**
 * The slice of `beforeLoad`'s argument a guard reads. Written structurally so a
 * guard can be handed straight to any route's `beforeLoad` without naming that
 * route's generated types.
 */
interface GuardArgs {
  context: { queryClient: QueryClient; auth: AuthContext }
  location: { href: string }
}

/**
 * Is anyone signed in at all — the cheap pre-flight the authenticated layout
 * runs. Whether the tokens are still accepted is the request layer's business,
 * and it signals a lapsed session by clearing the store.
 */
export function requireSession({ location }: GuardArgs): void {
  if (!hasSession()) {
    throw redirect({ to: "/login", search: { redirect: location.href } })
  }
}

/**
 * A `beforeLoad` that admits only users satisfying `rule`.
 *
 * ```ts
 * export const Route = createFileRoute("/_authenticated/_console/users")({
 *   beforeLoad: requireAccess(USERS_ACCESS),
 * })
 * ```
 *
 * Identity is re-read from the backend rather than taken from the cache: this
 * is the decision that actually opens a page, and it should be made against the
 * roles the user holds now, not the ones they held when the tab was opened.
 */
export function requireAccess(rule: AccessRule) {
  return async (args: GuardArgs): Promise<void> => {
    const { context, location } = args
    await refreshIdentity(context.queryClient, location.href)

    const reason = denialReason(context.auth, rule)
    if (reason) {
      throw redirect({
        to: "/unauthorized",
        search: { redirect: location.href, reason },
      })
    }
  }
}

/**
 * Pulls /auth/me past its stale time so the guard above decides on a current
 * answer, and turns the one interesting failure into the right redirect.
 *
 * A 401 here means the refresh token is gone too — the request layer has
 * already tried to renew by the time this throws. Anything else (an unreachable
 * backend, a 500) is left to the router's error component: refusing entry
 * because the network blinked would be the wrong call.
 */
async function refreshIdentity(
  queryClient: QueryClient,
  redirectHref: string
): Promise<void> {
  try {
    await queryClient.fetchQuery({ ...meQueryOptions(), staleTime: 0 })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      throw redirect({ to: "/login", search: { redirect: redirectHref } })
    }
    throw error
  }
}
