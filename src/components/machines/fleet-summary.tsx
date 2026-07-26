import { Card, CardContent } from "@/components/ui/card"
import { useClock } from "@/hooks/use-clock"
import { useFleetLiveMetrics } from "@/hooks/use-live-metrics"
import type { Machine, ServerInfo } from "@/lib/api/types"
import { formatBytes, formatPercent, formatUsage } from "@/lib/format"
import { normalizeSample } from "@/lib/metrics"
import { latestMetricsQueryOptions, samplesByMac } from "@/lib/queries/metrics"
import { cn } from "@/lib/utils"
import { useQuery } from "@tanstack/react-query"

interface Tile {
  label: string
  value: string
  detail?: string
}

const REPORTING_WINDOW_MS = 120_000

function Stat({ label, value, detail }: Tile) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {detail ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {detail}
          </span>
        ) : null}
      </CardContent>
    </Card>
  )
}

/** Fleet totals, including RAM against the sum of the machines' limits. */
export function FleetSummary({
  machines,
  servers,
}: {
  machines: Machine[]
  /** The full OpenStack fleet, when known — omitted inside saved views. */
  servers?: ServerInfo[]
}) {
  const { data: latest } = useQuery(latestMetricsQueryOptions())
  const { byMac } = useFleetLiveMetrics()
  const now = useClock()

  const latestByMac = samplesByMac(latest ?? [])
  const snapshots = machines
    .map((machine) => {
      const sample = byMac[machine.mac] ?? latestByMac[machine.mac]
      return sample ? normalizeSample(sample, machine) : null
    })
    .filter((snapshot) => snapshot !== null)

  const reporting = snapshots.filter(
    (snapshot) => now - Date.parse(snapshot.ts) <= REPORTING_WINDOW_MS
  ).length

  const cpuValues = snapshots
    .map((snapshot) => snapshot.cpuPercent)
    .filter((value) => value !== null)
  const avgCpu =
    cpuValues.length === 0
      ? null
      : cpuValues.reduce((sum, value) => sum + value, 0) / cpuValues.length

  const ramUsed = snapshots.reduce(
    (sum, snapshot) => sum + (snapshot.ram.usedBytes ?? 0),
    0
  )
  const ramTotal = snapshots.reduce(
    (sum, snapshot) => sum + (snapshot.ram.totalBytes ?? 0),
    0
  )

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-4",
        servers ? "lg:grid-cols-5" : "lg:grid-cols-4"
      )}
    >
      <Stat
        label="Machines"
        value={String(machines.length)}
        detail={`${machines.filter((machine) => machine.enabled).length} enabled`}
      />
      {servers ? (
        <Stat
          label="In OpenStack"
          value={String(servers.length)}
          detail={`${Math.max(0, servers.length - machines.length)} not monitored`}
        />
      ) : null}
      <Stat
        label="Reporting"
        value={`${reporting} / ${machines.length}`}
        detail="samples in the last 2 min"
      />
      <Stat
        label="Fleet CPU"
        value={avgCpu === null ? "—" : formatPercent(avgCpu)}
        detail={`average of ${cpuValues.length} machines`}
      />
      <Stat
        label="Fleet RAM"
        value={ramTotal === 0 ? "—" : formatPercent((ramUsed / ramTotal) * 100)}
        detail={
          ramTotal === 0
            ? undefined
            : `${formatUsage(ramUsed, ramTotal)} · ${formatBytes(
                ramTotal - ramUsed
              )} free`
        }
      />
    </div>
  )
}
