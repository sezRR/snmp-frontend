import { MachineActions } from "@/components/machines/machine-actions"
import { BandwidthCard } from "@/components/metrics/bandwidth-card"
import { DiskCard } from "@/components/metrics/disk-card"
import { LiveStatusIndicator } from "@/components/metrics/live-status-indicator"
import { MetricsLineChart } from "@/components/metrics/metrics-line-chart"
import { RadialMetricCard } from "@/components/metrics/radial-metric-card"
import { TimeRangePicker } from "@/components/metrics/time-range-picker"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useMachineLiveMetrics } from "@/hooks/use-live-metrics"
import { formatBps, formatPercent, formatUsage } from "@/lib/format"
import { mergeLiveIntoPoints } from "@/lib/live-buckets"
import {
  type MetricsSnapshot,
  normalizeSample,
  statsRowToPoint,
} from "@/lib/metrics"
import { machineName, machineQueryOptions } from "@/lib/queries/machines"
import {
  latestMetricsQueryOptions,
  metricStatsQueryOptions,
  recentSamplesQueryOptions,
  samplesByMac,
} from "@/lib/queries/metrics"
import { rememberMachine } from "@/lib/recent-machines"
import { TIME_RANGES, type TimeRangeKey, timeRangeKeys } from "@/lib/time-range"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import * as React from "react"
import { z } from "zod"

/** Points kept in the throughput sparkline on the bandwidth card. */
const SPARKLINE_POINTS = 60

const searchSchema = z.object({
  range: z
    .enum(timeRangeKeys as [TimeRangeKey, ...TimeRangeKey[]])
    .default("1h"),
})

export const Route = createFileRoute("/machines/$mac")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ range: search.range }),
  loader: ({ context, params, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(machineQueryOptions(params.mac)),
      context.queryClient.ensureQueryData(
        metricStatsQueryOptions(params.mac, deps.range)
      ),
    ]),
  pendingComponent: MachineDetailSkeleton,
  component: MachineDetailPage,
})

function MachineDetailPage() {
  const { mac } = Route.useParams()
  const { range } = Route.useSearch()
  const navigate = Route.useNavigate()

  const { data: machine } = useSuspenseQuery(machineQueryOptions(mac))
  const { data: stats } = useSuspenseQuery(metricStatsQueryOptions(mac, range))
  const { data: latest } = useQuery(latestMetricsQueryOptions())
  const { data: recent } = useQuery(recentSamplesQueryOptions(mac))
  const { latest: liveSample, history, status } = useMachineLiveMetrics(mac)

  // Visiting a machine is what makes it "recent" in the sidebar.
  React.useEffect(() => {
    rememberMachine(mac)
  }, [mac])

  const fallbackSample = samplesByMac(latest ?? [])[mac]
  const sample = liveSample ?? fallbackSample
  const snapshot = sample ? normalizeSample(sample, machine) : null

  // Raw samples give the throughput sparkline something to draw before the
  // first SSE event arrives; the live tail then extends it.
  const recentSnapshots = mergeSnapshots(
    (recent ?? []).map((entry) => normalizeSample(entry, machine)),
    history.map((entry) => normalizeSample(entry, machine))
  )
  const liveSnapshots = recentSnapshots.slice(-SPARKLINE_POINTS)

  // Historic buckets plus the live SSE tail, aggregated into the same interval
  // so the charts keep moving between refetches.
  const chartPoints = mergeLiveIntoPoints(
    stats.map(statsRowToPoint),
    recentSnapshots,
    TIME_RANGES[range].intervalMs
  )

  // The stats aggregate reads its own jsonb paths, so it can come back without
  // network columns even when the samples carry them. Fall back to bucketing
  // the raw samples rather than drawing an empty chart.
  const statsHaveNet = stats.some(
    (row) => row.net_rx_bps_avg !== null || row.net_tx_bps_avg !== null
  )
  const bandwidthPoints = statsHaveNet
    ? chartPoints
    : mergeLiveIntoPoints([], recentSnapshots, TIME_RANGES[range].intervalMs)

  const openstack = machine.openstack

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">{machineName(machine)}</h1>
        <Badge variant="secondary">{machine.ipv4}</Badge>
        <Badge variant="outline" className="font-mono">
          {machine.mac}
        </Badge>
        {!machine.enabled ? <Badge variant="secondary">disabled</Badge> : null}
        {!machine.openstack_found ? (
          <Badge variant="destructive">not in OpenStack</Badge>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <LiveStatusIndicator status={status} />
          <MachineActions machine={machine} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <RadialMetricCard
          title="CPU"
          description="Live utilization"
          value={snapshot?.cpuPercent ?? null}
          colorVar="var(--chart-1)"
          caption={snapshot?.cpuCores ? `${snapshot.cpuCores} vCPU` : undefined}
        />
        <RadialMetricCard
          title="RAM"
          description="Live utilization"
          value={snapshot?.ram.usedPercent ?? null}
          colorVar="var(--chart-2)"
          caption={
            snapshot
              ? formatUsage(snapshot.ram.usedBytes, snapshot.ram.totalBytes)
              : undefined
          }
          footnote={
            snapshot?.ram.totalFromFlavor
              ? "limit from OpenStack flavor"
              : undefined
          }
        />
        <DiskCard disks={snapshot?.disks ?? []} />
        <BandwidthCard latest={snapshot} history={liveSnapshots} />
      </div>

      {openstack ? (
        <Card>
          <CardHeader>
            <CardTitle>OpenStack</CardTitle>
            <CardDescription>
              Looked up per request, never persisted here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <Fact label="Server" value={openstack.name} />
              <Fact label="Status" value={openstack.status} />
              <Fact label="Tenant" value={openstack.tenant_name} />
              <Fact label="User" value={openstack.user_name} />
              <Fact label="Flavor" value={openstack.flavor.name} />
              <Fact label="vCPUs" value={String(openstack.flavor.vcpus)} />
              <Fact
                label="RAM limit"
                value={`${openstack.flavor.ram_mb} MiB`}
              />
              <Fact
                label="Disk limit"
                value={`${openstack.flavor.disk_gb} GiB`}
              />
            </dl>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">History</h2>
        <TimeRangePicker
          value={range}
          onChange={(next) => {
            // resetScroll would jump back to the top of the page on every
            // range change, losing the chart the user is looking at.
            void navigate({ search: { range: next }, resetScroll: false })
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <MetricsLineChart
          title="CPU, RAM & disk"
          description="Bucket average · live"
          data={chartPoints}
          range={range}
          valueFormatter={formatPercent}
          yDomain={[0, 100]}
          series={[
            {
              dataKey: "cpu_percent",
              label: "CPU",
              colorVar: "var(--chart-1)",
            },
            {
              dataKey: "ram_percent",
              label: "RAM",
              colorVar: "var(--chart-2)",
            },
            {
              dataKey: "disk_percent",
              label: "Disk",
              colorVar: "var(--chart-5)",
            },
          ]}
        />
        <MetricsLineChart
          title="Bandwidth"
          description="Bucket average · live"
          data={bandwidthPoints}
          range={range}
          valueFormatter={formatBps}
          series={[
            {
              dataKey: "net_rx_bps",
              label: "Inbound",
              colorVar: "var(--chart-3)",
            },
            {
              dataKey: "net_tx_bps",
              label: "Outbound",
              colorVar: "var(--chart-4)",
            },
          ]}
        />
      </div>
    </div>
  )
}

/**
 * Raw samples come back newest-first and overlap the live tail, so both are
 * keyed by timestamp — the live copy wins — and returned oldest-first, which
 * is the order the charts plot in.
 */
function mergeSnapshots(
  fetched: MetricsSnapshot[],
  live: MetricsSnapshot[]
): MetricsSnapshot[] {
  const byTs = new Map<number, MetricsSnapshot>()
  for (const snapshot of [...fetched, ...live]) {
    byTs.set(Date.parse(snapshot.ts), snapshot)
  }
  return [...byTs.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, snapshot]) => snapshot)
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  )
}

function MachineDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-56 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  )
}
