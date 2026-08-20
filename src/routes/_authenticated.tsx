import { AppBreadcrumbs } from "@/components/app-breadcrumbs"
import { AppSidebar } from "@/components/app-sidebar"
import { AccountMenu } from "@/components/auth/account-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { useLiveMetricsSync } from "@/hooks/use-live-sync"
import { useHasScope } from "@/lib/auth/rbac"
import { requireSession } from "@/lib/auth/route-guards"
import { SCOPES } from "@/lib/auth/scopes"
import { useSession } from "@/lib/auth/session"
import { meQueryOptions } from "@/lib/queries/auth"
import {
  Navigate,
  Outlet,
  createFileRoute,
  useLocation,
} from "@tanstack/react-router"

/**
 * Everything behind sign-in: the application shell, and the guard in front of
 * it. A pathless layout, so the URLs underneath are unchanged — `/machines` is
 * still `/machines`.
 */
export const Route = createFileRoute("/_authenticated")({
  // Only "is there a session at all". What that session may *do* is asked
  // further down, by the routes that care — see `_console` and its pages.
  beforeLoad: requireSession,
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
  const canReadMetrics = useHasScope(SCOPES.metricsRead)
  const location = useLocation()

  // One place feeds every page's "latest sample" cache from the stream. The
  // stream costs a ticket per connection, so it is not opened for a user who
  // could not read metrics with it.
  useLiveMetricsSync(session !== null && canReadMetrics)

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
    </SidebarProvider>
  )
}
