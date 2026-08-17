import {
  NotFoundScreen,
  RouteErrorScreen,
} from "@/components/errors/error-screen"
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
  context: { queryClient },
  defaultPreload: "intent",
  // React Query owns caching; don't double-cache loader results in the router
  defaultPreloadStaleTime: 0,
  // The same screen the backend gate uses, so a thrown route and a missing URL
  // fail in the application's own handwriting rather than the router's.
  defaultErrorComponent: ({ error, reset }) => (
    <RouteErrorScreen error={error} reset={reset} />
  ),
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
