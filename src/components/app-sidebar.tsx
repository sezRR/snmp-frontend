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
import { SCOPES, useHasScope } from "@/lib/auth/scopes"
import { Link, useLocation } from "@tanstack/react-router"
import { Activity, Wrench } from "lucide-react"
import * as React from "react"

const navItems = [
  { title: "Admin", to: "/admin", icon: Wrench, scope: SCOPES.adminRead },
] as const

interface RouteSectionOverrides {
  pathname: string
  values: Partial<Record<SidebarSection, boolean>>
}

export function AppSidebar() {
  const { pathname } = useLocation()
  const closeOnNavigate = useCloseOnNavigate()
  const sections = useSidebarSections()
  const [routeOverrides, setRouteOverrides] =
    React.useState<RouteSectionOverrides>(() => ({ pathname, values: {} }))
  // The admin page is nothing but collector and cache internals, so without
  // the scope to read them there is no page to navigate to.
  const canReadAdmin = useHasScope(SCOPES.adminRead)
  const visibleItems = navItems.filter(
    (item) => item.scope === null || canReadAdmin
  )

  if (routeOverrides.pathname !== pathname) {
    setRouteOverrides({ pathname, values: {} })
  }

  const sectionOpen = (section: SidebarSection) => {
    const override =
      routeOverrides.pathname === pathname
        ? routeOverrides.values[section]
        : undefined
    if (override !== undefined) return override

    const routeIsActive = pathname.startsWith(`/${section}`)
    return routeIsActive || sections[section]
  }

  const handleSectionOpenChange = (section: SidebarSection, open: boolean) => {
    setRouteOverrides((current) => ({
      pathname,
      values: {
        ...(current.pathname === pathname ? current.values : {}),
        [section]: open,
      },
    }))
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
          open={sectionOpen("machines")}
          onOpenChange={(open) => handleSectionOpenChange("machines", open)}
        />
        <ViewsNav
          open={sectionOpen("views")}
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
