import { BackendGate } from "@/components/errors/backend-gate"
import { Toaster } from "@/components/ui/sonner"
import type { AuthContext } from "@/lib/auth/rbac"
import type { QueryClient } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"

interface RouterContext {
  queryClient: QueryClient
  auth: AuthContext
}

function RootLayout() {
  return (
    <>
      <BackendGate>
        <Outlet />
      </BackendGate>
      <Toaster position="bottom-right" />
      {import.meta.env.DEV && (
        <>
          <TanStackRouterDevtools />
          <ReactQueryDevtools buttonPosition="bottom-right" />
        </>
      )}
    </>
  )
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})
