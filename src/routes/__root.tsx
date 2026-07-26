import { AppBreadcrumbs } from "@/components/app-breadcrumbs"
import { AppSidebar } from "@/components/app-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import type { QueryClient } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"

interface RouterContext {
  queryClient: QueryClient
}

const RootLayout = () => (
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
    {import.meta.env.DEV && (
      <>
        <TanStackRouterDevtools />
        <ReactQueryDevtools buttonPosition="bottom-right" />
      </>
    )}
  </SidebarProvider>
)

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})
