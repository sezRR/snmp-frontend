import { AppBreadcrumbs } from "@/components/app-breadcrumbs"
import { AppSidebar } from "@/components/app-sidebar"
import { AccountMenu } from "@/components/auth/account-menu"
import { FaultInjectorButton } from "@/components/dev/fault-injector"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { useLiveMetricsSync } from "@/hooks/use-live-sync"
import { SCOPES, useScopes } from "@/lib/auth/scopes"
import { hasSession, useSession } from "@/lib/auth/session"
import { meQueryOptions } from "@/lib/queries/auth"
import {
  Navigate,
  Outlet,
  createFileRoute,
  redirect,
  useLocation,
} from "@tanstack/react-router"

/**
 * Everything behind sign-in: the application shell, and the guard in front of
 * it. A pathless layout, so the URLs underneath are unchanged — `/machines` is
 * still `/machines`.
 */
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ location }) => {
    // Only a cheap "is there a session at all" check. Whether the tokens are
    // still accepted is the request layer's business, and it signals a lapsed
    // session by clearing the store, which the component below watches.
    if (!hasSession()) {
      throw redirect({ to: "/login", search: { redirect: location.href } })
    }
  },
  loader: async ({ context }) => {
    // Resolved before the first page renders so scope-gated actions do not
    // flash out of existence on every navigation. A failure is not fatal: the
    // pages render read-only and the guard below handles a dead session.
    try {
      await context.queryClient.ensureQueryData(meQueryOptions())
    } catch {
      // an unreachable backend, or credentials that no longer work
    }
  },
  component: AuthedLayout,
})

function AuthedLayout() {
  const session = useSession()
  const scopes = useScopes()
  const location = useLocation()

  // One place feeds every page's "latest sample" cache from the stream. The
  // stream costs a ticket per connection, so it is not opened for a user who
  // could not read metrics with it.
  useLiveMetricsSync(session !== null && scopes.includes(SCOPES.metricsRead))

  // The session can end while the app is mounted: a refresh token the backend
  // refuses, or a sign-out in another tab.
  if (!session) {
    return <Navigate to="/login" search={{ redirect: location.href }} replace />
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <AppBreadcrumbs />
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <AccountMenu />
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4">
          <Outlet />
        </main>
      </SidebarInset>
      {/* Statically false in a production build, so this is dropped. */}
      {import.meta.env.DEV && <FaultInjectorButton />}
    </SidebarProvider>
  )
}
