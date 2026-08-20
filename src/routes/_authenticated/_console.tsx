import { CONSOLE_ACCESS } from "@/lib/auth/access"
import { requireAccess } from "@/lib/auth/route-guards"
import { Outlet, createFileRoute } from "@tanstack/react-router"

/**
 * The administration console — /admin, /users and /roles — behind one gate.
 *
 * Pathless, so the addresses underneath are unchanged, and deliberately looser
 * than the pages it wraps: it asks only whether the visitor belongs in the
 * console at all, and each page then asks for the permission it actually needs.
 * Two layers rather than one because this is where the layout, the sidebar
 * section and the "you are somewhere administrative" answer belong; duplicating
 * the union of three scopes into each page would leave three places to forget.
 */
export const Route = createFileRoute("/_authenticated/_console")({
  beforeLoad: requireAccess(CONSOLE_ACCESS),
  component: ConsoleLayout,
})

function ConsoleLayout() {
  return <Outlet />
}
