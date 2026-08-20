import {
  NotFoundScreen,
  RouteErrorScreen,
} from "@/components/errors/error-screen"
import { createRouterAuth } from "@/lib/auth/rbac"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import { StrictMode } from "react"
import ReactDOM from "react-dom/client"

import { ThemeProvider } from "./components/theme-provider"
import "./index.css"
// Import the generated route tree
import { routeTree } from "./routeTree.gen"

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

// Create a new router instance
const router = createRouter({
  routeTree,
  // `auth` reads the identity out of the cache on every call, so this one
  // object stays correct as the signed-in user changes underneath it.
  context: { queryClient, auth: createRouterAuth(queryClient) },
  defaultPreload: "intent",
  // React Query owns caching; don't double-cache loader results in the router
  defaultPreloadStaleTime: 0,
  // The same screen the backend gate uses, so a thrown route and a missing URL
  // fail in the application's own handwriting rather than the router's.
  defaultErrorComponent: ({ error }) => <RouteErrorScreen error={error} />,
  defaultNotFoundComponent: () => <NotFoundScreen />,
})

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

// Render the app
const rootElement = document.getElementById("root")!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="system" storageKey="theme">
          <RouterProvider router={router} />
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>
  )
}
