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
import { sanitizeReturnTo } from "@/lib/auth/search"
import { useSession } from "@/lib/auth/session"
import { meQueryOptions } from "@/lib/queries/auth"
import {
  Outlet,
  createFileRoute,
  useLocation,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router"
import * as React from "react"

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: requireSession,
  loader: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(meQueryOptions())
    } catch {}
  },
  component: AuthedLayout,
})

function AuthedLayout() {
  const session = useSession()
  const canReadMetrics = useHasScope(SCOPES.metricsRead)
  const location = useLocation()
  const navigate = useNavigate()
  const routerIsLoading = useRouterState({ select: (state) => state.isLoading })
  const redirectStarted = React.useRef(false)

  useLiveMetricsSync(session !== null && canReadMetrics)

  // The last address that was actually behind the guard. `Navigate` re-runs on
  // every render, and by the time it does the location is already /login — so
  // reading it live would send /login back to itself, nesting one encoded copy
  // of the URL inside the next until React gives up.
  const [returnTo, setReturnTo] = React.useState(location.href)
  if (session && returnTo !== location.href) setReturnTo(location.href)

  React.useEffect(() => {
    if (session) {
      redirectStarted.current = false
      return
    }
    // A pending route guard owns redirects caused by its identity refresh.
    if (routerIsLoading) return
    if (redirectStarted.current) return

    redirectStarted.current = true
    void navigate({
      to: "/login",
      search: { redirect: sanitizeReturnTo(returnTo) },
      replace: true,
    })
  }, [navigate, returnTo, routerIsLoading, session])

  if (!session) return null

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
