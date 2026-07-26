import {
  MachineStatusDot,
  machineHealth,
} from "@/components/sidebar/machine-status-dot"
import { useCloseOnNavigate } from "@/components/sidebar/use-close-on-navigate"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useClock } from "@/hooks/use-clock"
import { useFleetLiveMetrics } from "@/hooks/use-live-metrics"
import { shortMac } from "@/lib/format"
import {
  collectorMachineHealth,
  collectorStatusQueryOptions,
} from "@/lib/queries/admin"
import { machineName, machinesQueryOptions } from "@/lib/queries/machines"
import { latestMetricsQueryOptions, samplesByMac } from "@/lib/queries/metrics"
import { useRecentMachines } from "@/lib/recent-machines"
import { useQuery } from "@tanstack/react-query"
import { Link, useParams } from "@tanstack/react-router"

/** The last three machines opened on this client, newest first. */
export function RecentMachinesNav() {
  const recent = useRecentMachines()
  const { mac: openMac } = useParams({ strict: false })
  const { data: machines } = useQuery(machinesQueryOptions())
  const { data: latest } = useQuery(latestMetricsQueryOptions())
  const { data: collector } = useQuery(collectorStatusQueryOptions())
  const { byMac } = useFleetLiveMetrics()
  const now = useClock()
  const closeOnNavigate = useCloseOnNavigate()

  const health = collectorMachineHealth(collector)
  const latestByMac = samplesByMac(latest ?? [])

  const rows = recent
    .map((mac) => machines?.find((machine) => machine.mac === mac))
    .filter((machine) => machine !== undefined)

  if (rows.length === 0) return null

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Recent</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {rows.map((machine) => {
            const sample = byMac[machine.mac] ?? latestByMac[machine.mac]
            return (
              <SidebarMenuItem key={machine.mac}>
                <SidebarMenuButton
                  tooltip={machineName(machine)}
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
                    className="ml-1"
                    health={machineHealth({
                      enabled: machine.enabled,
                      latestTs: sample?.ts,
                      failing: (health[machine.mac]?.failure ?? 0) > 0,
                      now,
                    })}
                  />
                  <span className="flex flex-1 items-baseline gap-2 overflow-hidden">
                    <span className="truncate">{machineName(machine)}</span>
                    <span className="shrink-0 font-mono text-[0.7rem] text-muted-foreground">
                      {shortMac(machine.mac)}
                    </span>
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
