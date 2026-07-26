import { useCloseOnNavigate } from "@/components/sidebar/use-close-on-navigate"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { ViewDialog } from "@/components/views/view-dialog"
import { type View, deleteView, useViews } from "@/lib/views"
import { Link, useNavigate, useParams } from "@tanstack/react-router"
import { LayoutGrid, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"

/** Client-side saved subsets of the fleet, kept in localStorage. */
export function ViewsNav() {
  const views = useViews()
  const navigate = useNavigate()
  const { viewId: openViewId } = useParams({ strict: false })
  const [editing, setEditing] = React.useState<View | undefined>(undefined)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const closeOnNavigate = useCloseOnNavigate()

  const openCreate = () => {
    setEditing(undefined)
    setDialogOpen(true)
  }

  const handleDelete = (view: View) => {
    deleteView(view.id)
    toast.success(`View "${view.name}" deleted`)
    if (openViewId === view.id) void navigate({ to: "/" })
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Views</SidebarGroupLabel>
      <SidebarGroupAction title="New view" onClick={openCreate}>
        <Plus />
        <span className="sr-only">New view</span>
      </SidebarGroupAction>
      <SidebarGroupContent>
        <SidebarMenu>
          {views.length === 0 ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="New view"
                className="text-muted-foreground"
                onClick={openCreate}
              >
                <Plus />
                <span>New view</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : (
            views.map((view) => (
              <SidebarMenuItem key={view.id}>
                <SidebarMenuButton
                  tooltip={view.name}
                  isActive={openViewId === view.id}
                  render={
                    <Link
                      to="/views/$viewId"
                      params={{ viewId: view.id }}
                      onClick={closeOnNavigate}
                    />
                  }
                >
                  <LayoutGrid />
                  <span className="flex-1 truncate">{view.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {view.macs.length}
                  </span>
                </SidebarMenuButton>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <SidebarMenuAction showOnHover>
                        <MoreHorizontal />
                        <span className="sr-only">View actions</span>
                      </SidebarMenuAction>
                    }
                  />
                  <DropdownMenuContent align="start" side="right">
                    <DropdownMenuItem
                      onClick={() => {
                        setEditing(view)
                        setDialogOpen(true)
                      }}
                    >
                      <Pencil />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => handleDelete(view)}
                    >
                      <Trash2 />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            ))
          )}
        </SidebarMenu>
      </SidebarGroupContent>
      <ViewDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        view={editing}
        onSaved={(view) =>
          void navigate({ to: "/views/$viewId", params: { viewId: view.id } })
        }
      />
    </SidebarGroup>
  )
}
