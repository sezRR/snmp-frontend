import { useCloseOnNavigate } from "@/components/sidebar/use-close-on-navigate"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { ViewDialog } from "@/components/views/view-dialog"
import { cn } from "@/lib/utils"
import { type View, deleteView, useViews } from "@/lib/views"
import { Link, useNavigate, useParams } from "@tanstack/react-router"
import {
  ChevronRight,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import * as React from "react"
import { toast } from "sonner"

interface ViewsNavProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Client-side saved subsets of the fleet, kept in localStorage. */
export function ViewsNav({ open, onOpenChange }: ViewsNavProps) {
  const views = useViews()
  const navigate = useNavigate()
  const { viewId: openViewId } = useParams({ strict: false })
  const [editing, setEditing] = React.useState<View | undefined>(undefined)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const closeOnNavigate = useCloseOnNavigate()
  const { isMobile, setOpen, state } = useSidebar()

  const openCreate = () => {
    setEditing(undefined)
    setDialogOpen(true)
  }

  const handleDelete = (view: View) => {
    deleteView(view.id)
    toast.success(`View "${view.name}" deleted`)
    if (openViewId === view.id) void navigate({ to: "/" })
  }

  const handleToggle = () => {
    if (!isMobile && state === "collapsed") {
      setOpen(true)
      onOpenChange(true)
      return
    }
    onOpenChange(!open)
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Views"
              isActive={openViewId !== undefined}
              aria-expanded={open}
              aria-controls="sidebar-views"
              onClick={handleToggle}
            >
              <LayoutGrid />
              <span>Views</span>
              <ChevronRight
                className={cn(
                  "ml-auto transition-transform duration-200",
                  open && "rotate-90"
                )}
              />
            </SidebarMenuButton>
            <SidebarMenuAction
              title="New view"
              aria-label="New view"
              onClick={openCreate}
            >
              <Plus />
            </SidebarMenuAction>

            {open ? (
              <SidebarMenuSub id="sidebar-views">
                {views.length === 0 ? (
                  <SidebarMenuSubItem className="px-8 py-1.5 text-xs text-muted-foreground">
                    No saved views
                  </SidebarMenuSubItem>
                ) : (
                  views.map((view) => (
                    <SidebarMenuSubItem
                      key={view.id}
                      className="group/menu-item relative"
                    >
                      <SidebarMenuSubButton
                        title={view.name}
                        className="pr-7 pl-8"
                        isActive={openViewId === view.id}
                        render={
                          <Link
                            to="/views/$viewId"
                            params={{ viewId: view.id }}
                            onClick={closeOnNavigate}
                          />
                        }
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="truncate">{view.name}</span>
                          <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                            {view.macs.length}
                          </span>
                        </div>
                      </SidebarMenuSubButton>
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
                    </SidebarMenuSubItem>
                  ))
                )}
              </SidebarMenuSub>
            ) : null}
          </SidebarMenuItem>
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
