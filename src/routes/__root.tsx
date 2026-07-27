import { AppBreadcrumbs } from "@/components/app-breadcrumbs"
import { AppSidebar } from "@/components/app-sidebar"
import { FaultInjectorButton } from "@/components/dev/fault-injector"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { useLiveMetricsSync } from "@/hooks/use-live-sync"
import type { QueryClient } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"

interface RouterContext {
  queryClient: QueryClient
}

function RootLayout() {
  // One place feeds every page's "latest sample" cache from the stream.
  useLiveMetricsSync()

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <AppBreadcrumbs />
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4">
          <Outlet />
        </main>
      </SidebarInset>
      <Toaster />
      {/* Statically false in a production build, so all of this is dropped. */}
      {import.meta.env.DEV && (
        <>
          <FaultInjectorButton />
          <TanStackRouterDevtools />
          <ReactQueryDevtools buttonPosition="bottom-right" />
        </>
      )}
    </SidebarProvider>
  )
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})
