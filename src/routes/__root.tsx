import { BackendGate } from "@/components/errors/backend-gate"
import { Toaster } from "@/components/ui/sonner"
import type { QueryClient } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"

interface RouterContext {
  queryClient: QueryClient
}

/**
 * Everything that has to exist on both sides of the sign-in boundary: the
 * backend gate, the toaster, and the devtools. The application shell lives in
 * the `_authenticated` layout instead, so the login page is not framed by a sidebar
 * full of navigation the visitor cannot use yet.
 */
function RootLayout() {
  return (
    <>
      <BackendGate>
        <Outlet />
      </BackendGate>
      <Toaster position="bottom-right" />
      {/* Statically false in a production build, so all of this is dropped. */}
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
