import { AddMachineDialog } from "@/components/machines/add-machine-dialog"
import { DeregisterMachinesDialog } from "@/components/machines/deregister-machines-dialog"
import { MachineActions } from "@/components/machines/machine-actions"
import {
  MachineStatusDot,
  machineHealth,
} from "@/components/sidebar/machine-status-dot"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useFleetLiveMetrics } from "@/hooks/use-live-metrics"
import { formatTimestamp } from "@/lib/format"
import {
  collectorMachineHealth,
  useCollectorStatusQuery,
} from "@/lib/queries/admin"
import { machineName, machinesQueryOptions } from "@/lib/queries/machines"
import { latestMetricsQueryOptions, samplesByMac } from "@/lib/queries/metrics"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { Server } from "lucide-react"

export const Route = createFileRoute("/_authed/machines/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(machinesQueryOptions()),
  pendingComponent: () => <Skeleton className="h-64 rounded-xl" />,
  component: MachinesPage,
})

function MachinesPage() {
  const { data: machines } = useSuspenseQuery(machinesQueryOptions())
  const { data: latest } = useQuery(latestMetricsQueryOptions())
  const { data: collector } = useCollectorStatusQuery()
  const { byMac } = useFleetLiveMetrics()

  const latestByMac = samplesByMac(latest ?? [])
  const health = collectorMachineHealth(collector)

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Machines</h1>
        <div className="flex items-center gap-2">
          {machines.length > 0 ? <DeregisterMachinesDialog /> : null}
          <AddMachineDialog />
        </div>
      </div>
      {machines.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Server />
            </EmptyMedia>
            <EmptyTitle>No machines registered</EmptyTitle>
            <EmptyDescription>
              Register an address to start polling it. The OpenStack cache is
              offered as a shortcut, not a requirement.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Registered machines</CardTitle>
            <CardDescription>
              {machines.length} machine{machines.length === 1 ? "" : "s"} polled
              over SNMP
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col">
            {machines.map((machine, index) => {
              const sample = byMac[machine.mac] ?? latestByMac[machine.mac]
              return (
                <div key={machine.mac}>
                  {index > 0 ? <Separator /> : null}
                  <div className="flex items-center gap-3 px-2 py-3">
                    <MachineStatusDot
                      health={machineHealth({
                        enabled: machine.enabled,
                        hasSample: sample !== undefined,
                        failing: health[machine.mac]?.failing,
                      })}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <Link
                        to="/machines/$mac"
                        params={{ mac: machine.mac }}
                        className="truncate font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {machineName(machine)}
                      </Link>
                      <span className="truncate text-xs text-muted-foreground">
                        {machine.ipv4} ·{" "}
                        <span className="font-mono">{machine.mac}</span>
                        {/* The collector's own stamp, shown as it recorded it.
                            Ageing it against this browser would only report
                            how far the two clocks have drifted apart. */}
                        {sample
                          ? ` · sampled ${formatTimestamp(sample.ts)}`
                          : " · no samples"}
                      </span>
                    </div>
                    {machine.openstack ? (
                      <Badge variant="outline" className="hidden sm:flex">
                        {machine.openstack.flavor.name}
                      </Badge>
                    ) : machine.external ? (
                      <Badge variant="outline">external</Badge>
                    ) : (
                      <Badge variant="destructive">not in OpenStack</Badge>
                    )}
                    {!machine.enabled ? (
                      <Badge variant="secondary">disabled</Badge>
                    ) : null}
                    {machine.credential_id ? null : (
                      <Badge variant="destructive">no credential</Badge>
                    )}
                    <MachineActions machine={machine} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
