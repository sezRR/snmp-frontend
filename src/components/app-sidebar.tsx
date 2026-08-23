import { CollectorHealthFooter } from "@/components/sidebar/collector-health"
import { MachinesNav } from "@/components/sidebar/machines-nav"
import {
  type SidebarSection,
  setSidebarSection,
  useSidebarSections,
} from "@/components/sidebar/sidebar-sections"
import { useCloseOnNavigate } from "@/components/sidebar/use-close-on-navigate"
import { ViewsNav } from "@/components/sidebar/views-nav"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { ADMIN_ACCESS, ROLES_ACCESS, USERS_ACCESS } from "@/lib/auth/access"
import { allows, useAuth } from "@/lib/auth/rbac"
import { Link, useLocation } from "@tanstack/react-router"
import { Activity, ShieldCheck, Users, Wrench } from "lucide-react"

const navItems = [
  { title: "Admin", to: "/admin", icon: Wrench, access: ADMIN_ACCESS },
  { title: "Users", to: "/users", icon: Users, access: USERS_ACCESS },
  { title: "Roles", to: "/roles", icon: ShieldCheck, access: ROLES_ACCESS },
] as const

export function AppSidebar() {
  const { pathname } = useLocation()
  const closeOnNavigate = useCloseOnNavigate()
  const sections = useSidebarSections()
  const auth = useAuth()
  const visibleItems = navItems.filter((item) => allows(auth, item.access))

  const handleSectionOpenChange = (section: SidebarSection, open: boolean) => {
    setSidebarSection(section, open)
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link to="/" onClick={closeOnNavigate} />}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Activity className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">SNMP Monitor</span>
                <span className="truncate text-xs text-muted-foreground">
                  OpenStack fleet metrics
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <MachinesNav
          open={sections.machines}
          onOpenChange={(open) => handleSectionOpenChange("machines", open)}
        />
        <ViewsNav
          open={sections.views}
          onOpenChange={(open) => handleSectionOpenChange("views", open)}
        />
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const isActive = pathname.startsWith(item.to)
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={isActive}
                      render={<Link to={item.to} onClick={closeOnNavigate} />}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <CollectorHealthFooter />
    </Sidebar>
  )
}
