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
