import { MachineActions } from "@/components/machines/machine-actions"
import {
  MachineStatusDot,
  machineHealth,
} from "@/components/sidebar/machine-status-dot"
import { useCloseOnNavigate } from "@/components/sidebar/use-close-on-navigate"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
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
} from "@/components/ui/sidebar"
import { useFleetLiveMetrics } from "@/hooks/use-live-metrics"
import type { Machine } from "@/lib/api/types"
import {
  collectorMachineHealth,
  useCollectorStatusQuery,
} from "@/lib/queries/admin"
import { machineName, machinesQueryOptions } from "@/lib/queries/machines"
import { latestMetricsQueryOptions, samplesByMac } from "@/lib/queries/metrics"
import { cn } from "@/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { Link, useLocation, useParams } from "@tanstack/react-router"
import { ChevronRight, MoreHorizontal, Server } from "lucide-react"

const MACHINE_PREVIEW_LIMIT = 12
const machineCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
})

function compareMachines(left: Machine, right: Machine): number {
  return machineCollator.compare(machineName(left), machineName(right))
}

interface MachinesNavProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Fleet navigation stays bounded so machines cannot crowd out other pages. */
export function MachinesNav({ open, onOpenChange }: MachinesNavProps) {
  const { pathname } = useLocation()
  const { mac: openMac } = useParams({ strict: false })
  const {
    data: machines,
    isError,
    isPending,
  } = useQuery({
    ...machinesQueryOptions(),
    enabled: open,
  })
  const { data: latest } = useQuery({
    ...latestMetricsQueryOptions(),
    enabled: open,
  })
  const { data: collector } = useCollectorStatusQuery()
  const { byMac } = useFleetLiveMetrics({ enabled: open })
  const closeOnNavigate = useCloseOnNavigate()

  const health = collectorMachineHealth(collector)
  const latestByMac = samplesByMac(latest ?? [])
  const sorted = [...(machines ?? [])].sort(compareMachines)
  const visible = sorted.slice(0, MACHINE_PREVIEW_LIMIT)
  const activeMachine = sorted.find((machine) => machine.mac === openMac)
  if (
    activeMachine &&
    !visible.some((machine) => machine.mac === activeMachine.mac)
  ) {
    visible.push(activeMachine)
    visible.sort(compareMachines)
  }
  const remaining = sorted.length - visible.length

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <Collapsible
              open={open}
              onOpenChange={onOpenChange}
              className="contents"
            >
              <SidebarMenuButton
                tooltip="Machines"
                isActive={pathname.startsWith("/machines")}
                render={<Link to="/machines" onClick={closeOnNavigate} />}
              >
                <Server />
                <span>Machines</span>
              </SidebarMenuButton>
              <CollapsibleTrigger
                render={
                  <SidebarMenuAction
                    title={open ? "Collapse machines" : "Expand machines"}
                    aria-label={open ? "Collapse machines" : "Expand machines"}
                  />
                }
              >
                <ChevronRight
                  className={cn(
                    "transition-transform duration-200 ease-[var(--ease-in-out)] motion-reduce:transition-none",
                    open && "rotate-90"
                  )}
                />
              </CollapsibleTrigger>

              <CollapsibleContent
                render={<SidebarMenuSub id="sidebar-machines" />}
              >
                {isPending ? (
                  <SidebarMenuSubItem className="py-1.5 pr-2 pl-3 text-xs text-muted-foreground">
                    Loading machines...
                  </SidebarMenuSubItem>
                ) : isError ? (
                  <SidebarMenuSubItem className="py-1.5 pr-2 pl-3 text-xs text-destructive">
                    Machines unavailable
                  </SidebarMenuSubItem>
                ) : visible.length === 0 ? (
                  <SidebarMenuSubItem className="py-1.5 pr-2 pl-3 text-xs text-muted-foreground">
                    No machines registered
                  </SidebarMenuSubItem>
                ) : (
                  visible.map((machine) => {
                    const sample =
                      byMac[machine.mac] ?? latestByMac[machine.mac]
                    return (
                      <SidebarMenuSubItem key={machine.mac}>
                        <SidebarMenuSubButton
                          title={`${machineName(machine)}\nIP: ${machine.ipv4}\nMAC: ${machine.mac}`}
                          className="pl-3"
                          isActive={openMac === machine.mac}
                          render={
                            <Link
                              to="/machines/$mac"
                              params={{ mac: machine.mac }}
                              onClick={closeOnNavigate}
                            />
                          }
                        >
                          <MachineStatusDot
                            health={machineHealth({
                              enabled: machine.enabled,
                              hasSample: sample !== undefined,
                              failing: health[machine.mac]?.failing,
                            })}
                          />
                          <span>{machineName(machine)}</span>
                        </SidebarMenuSubButton>
                        <MachineActions
                          machine={machine}
                          includeViewAction={false}
                          onDeregistered={closeOnNavigate}
                          trigger={
                            <SidebarMenuAction showOnHover="menu-sub-item">
                              <MoreHorizontal />
                              <span className="sr-only">Machine actions</span>
                            </SidebarMenuAction>
                          }
                        />
                      </SidebarMenuSubItem>
                    )
                  })
                )}

                {remaining > 0 ? (
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      className="pl-3"
                      render={<Link to="/machines" onClick={closeOnNavigate} />}
                    >
                      <MoreHorizontal />
                      <span>
                        {remaining} more machine{remaining === 1 ? "" : "s"}
                      </span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ) : null}
              </CollapsibleContent>
            </Collapsible>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
