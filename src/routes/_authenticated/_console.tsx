import { CONSOLE_ACCESS } from "@/lib/auth/access"
import { requireAccess } from "@/lib/auth/route-guards"
import { Outlet, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_authenticated/_console")({
  beforeLoad: requireAccess(CONSOLE_ACCESS),
  component: ConsoleLayout,
})

function ConsoleLayout() {
  return <Outlet />
}
