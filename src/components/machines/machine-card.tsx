import { MachineActions } from "@/components/machines/machine-actions"
import {
  MachineStatusDot,
  machineHealth,
} from "@/components/sidebar/machine-status-dot"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Machine, MetricSample } from "@/lib/api/types"
import {
  formatBps,
  formatBytesRate,
  formatPercent,
  formatUsage,
} from "@/lib/format"
import { normalizeSample } from "@/lib/metrics"
import { machineName } from "@/lib/queries/machines"
import { Link } from "@tanstack/react-router"
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpFromLine,
  Building2,
  User,
} from "lucide-react"

const diskRate = (value: number | null): string =>
  value === null ? "n/a" : formatBytesRate(value)

interface MachineCardProps {
  machine: Machine
  /** Newest sample from the fleet stream, or the /metrics/latest fallback. */
  sample?: MetricSample
  failing?: boolean
}

export function MachineCard({ machine, sample, failing }: MachineCardProps) {
  const snapshot = sample ? normalizeSample(sample, machine) : null
  const vcpus = snapshot?.cpuCores ?? machine.openstack?.flavor.vcpus ?? null

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MachineStatusDot
            health={machineHealth({
              enabled: machine.enabled,
              hasSample: sample !== undefined,
              failing,
            })}
          />
          <Link
            to="/machines/$mac"
            params={{ mac: machine.mac }}
            className="truncate rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {machineName(machine)}
          </Link>
        </CardTitle>
        <CardDescription className="flex flex-col gap-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span>{machine.ipv4}</span>
            {!machine.enabled ? (
              <Badge variant="secondary">disabled</Badge>
            ) : null}
            {/* Registered with nothing to authenticate a poll with, so the
                collector skips it entirely — worth saying out loud, since
                every metric below would otherwise just read "n/a". */}
            {machine.credential_id ? null : (
              <Badge variant="destructive">no credential</Badge>
            )}
            {/* Expected for an external machine, so that states the fact. A
                managed one missing its record is a machine that moved or was
                deleted in OpenStack after registration — worth flagging. */}
            {machine.external ? (
              <Badge variant="outline">external</Badge>
            ) : !machine.openstack_found ? (
              <Badge variant="destructive">not in OpenStack</Badge>
            ) : null}
          </span>
          {machine.openstack ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">
                <Building2 data-icon="inline-start" />
                {machine.openstack.tenant_name}
              </Badge>
              <Badge variant="outline">
                <User data-icon="inline-start" />
                {machine.openstack.user_name}
              </Badge>
              <Badge variant="outline">{machine.openstack.flavor.name}</Badge>
              <Badge variant="secondary">{machine.openstack.status}</Badge>
            </span>
          ) : null}
        </CardDescription>
        <CardAction>
          <MachineActions machine={machine} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">CPU</dt>
            <dd className="font-medium tabular-nums">
              {snapshot?.cpuPercent == null
                ? "n/a"
                : formatPercent(snapshot.cpuPercent)}
            </dd>
            <dd className="text-xs text-muted-foreground tabular-nums">
              {vcpus === null ? "n/a" : `${vcpus} vCPU`}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">RAM</dt>
            <dd className="font-medium tabular-nums">
              {snapshot?.ram.usedPercent == null
                ? "n/a"
                : formatPercent(snapshot.ram.usedPercent)}
            </dd>
            <dd className="text-xs text-muted-foreground tabular-nums">
              {snapshot
                ? formatUsage(snapshot.ram.usedBytes, snapshot.ram.totalBytes)
                : "n/a"}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">Disk</dt>
            <dd className="font-medium tabular-nums">
              {snapshot?.primaryDisk?.usedPercent == null
                ? "n/a"
                : formatPercent(snapshot.primaryDisk.usedPercent)}
            </dd>
            <dd className="text-xs text-muted-foreground tabular-nums">
              {snapshot?.primaryDisk
                ? formatUsage(
                    snapshot.primaryDisk.usedBytes,
                    snapshot.primaryDisk.totalBytes
                  )
                : "n/a"}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">Disk I/O</dt>
            <dd className="flex flex-col font-medium tabular-nums">
              <span className="flex items-center gap-1">
                <ArrowDownToLine className="size-3 text-chart-1" />
                {diskRate(snapshot?.diskIo.readBps ?? null)}
              </span>
              <span className="flex items-center gap-1">
                <ArrowUpFromLine className="size-3 text-chart-4" />
                {diskRate(snapshot?.diskIo.writeBps ?? null)}
              </span>
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">Bandwidth</dt>
            <dd className="flex flex-col font-medium tabular-nums">
              <span className="flex items-center gap-1">
                <ArrowDown className="size-3 text-chart-3" />
                {snapshot?.net.rxBps == null
                  ? "n/a"
                  : formatBps(snapshot.net.rxBps)}
              </span>
              <span className="flex items-center gap-1">
                <ArrowUp className="size-3 text-chart-4" />
                {snapshot?.net.txBps == null
                  ? "n/a"
                  : formatBps(snapshot.net.txBps)}
              </span>
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}
