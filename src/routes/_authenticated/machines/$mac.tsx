import { MachineActions } from "@/components/machines/machine-actions"
import { BandwidthCard } from "@/components/metrics/bandwidth-card"
import { DiskCard } from "@/components/metrics/disk-card"
import { DiskIoCard } from "@/components/metrics/disk-io-card"
import { LiveStatusIndicator } from "@/components/metrics/live-status-indicator"
import { MetricsLineChart } from "@/components/metrics/metrics-line-chart"
import { RadialMetricCard } from "@/components/metrics/radial-metric-card"
import { TimeRangePicker } from "@/components/metrics/time-range-picker"
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
import { Skeleton } from "@/components/ui/skeleton"
import { useMachineLiveMetrics } from "@/hooks/use-live-metrics"
import {
  formatBps,
  formatBytesRate,
  formatIops,
  formatPercent,
  formatUsage,
} from "@/lib/format"
import { mergeLiveIntoPoints } from "@/lib/live-buckets"
import {
  type MetricsSnapshot,
  normalizeSample,
  statsRowToPoint,
} from "@/lib/metrics"
import {
  collectorMachineHealth,
  useCollectorStatusQuery,
} from "@/lib/queries/admin"
import { machineName, machineQueryOptions } from "@/lib/queries/machines"
import {
  latestMetricsQueryOptions,
  metricStatsQueryOptions,
  recentSamplesQueryOptions,
  samplesByMac,
} from "@/lib/queries/metrics"
import { TIME_RANGES, type TimeRangeKey, timeRangeKeys } from "@/lib/time-range"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

/** Points kept in the throughput sparkline on the bandwidth card. */
const SPARKLINE_POINTS = 60

const hasMetricValue = (...values: (number | null | undefined)[]): boolean =>
  values.some((value) => typeof value === "number")

const searchSchema = z.object({
  range: z
    .enum(timeRangeKeys as [TimeRangeKey, ...TimeRangeKey[]])
    .default("1h"),
})

export const Route = createFileRoute("/_authenticated/machines/$mac")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ range: search.range }),
  loader: ({ context, params, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(machineQueryOptions(params.mac)),
      context.queryClient.ensureQueryData(
        metricStatsQueryOptions(params.mac, deps.range)
      ),
    ]),
  pendingMs: 0,
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
  const { data: collector } = useCollectorStatusQuery()
  const { latest: liveSample, history, status } = useMachineLiveMetrics(mac)

  // The aggregate reads its own jsonb paths, so any metric group can be empty
  // even when raw samples carry it. Omitted fields count as missing too.
  const statsHaveUsage = stats.some((row) =>
    hasMetricValue(
      row.cpu_usage_percent_avg,
      row.ram_used_percent_avg,
      row.disk_used_percent_avg
    )
  )
  const statsHaveNet = stats.some((row) =>
    hasMetricValue(row.net_rx_bps_avg, row.net_tx_bps_avg)
  )
  const statsHaveDiskIo = stats.some((row) =>
    hasMetricValue(
      row.disk_read_bps_avg,
      row.disk_write_bps_avg,
      row.disk_read_iops_avg,
      row.disk_write_iops_avg
    )
  )
  const { data: recent } = useQuery({
    ...recentSamplesQueryOptions(mac),
    enabled: !statsHaveUsage || !statsHaveNet || !statsHaveDiskIo,
  })

  const fallbackSample = samplesByMac(latest ?? [])[mac]
  const sample = liveSample ?? fallbackSample
  const snapshot = sample ? normalizeSample(sample, machine) : null

  // Same dot as the grid and the sidebar: whether the collector's last poll of
  // this machine succeeded, which is the one party to the exchange that can
  // answer without comparing clocks.
  const failing = collectorMachineHealth(collector)[mac]?.failing

  // The live card is exactly that: it starts empty on arrival and fills from
  // the stream, so it never mixes in history the user did not watch arrive.
  const liveSnapshots = history
    .map((entry) => normalizeSample(entry, machine))
    .slice(-SPARKLINE_POINTS)

  // Historic buckets plus the live SSE tail, aggregated into the same interval
  // so the charts keep moving between refetches.
  const chartPoints = mergeLiveIntoPoints(
    stats.map(statsRowToPoint),
    liveSnapshots,
    TIME_RANGES[range].intervalMs
  )

  // When the aggregate has no values for a metric group, raw samples still may
  // carry them, so the corresponding chart is drawn from those instead.
  const samplePoints = mergeLiveIntoPoints(
    [],
    mergeSnapshots(
      (recent ?? []).map((entry) => normalizeSample(entry, machine)),
      liveSnapshots
    ),
    TIME_RANGES[range].intervalMs
  )

  const usagePoints = statsHaveUsage ? chartPoints : samplePoints
  const bandwidthPoints = statsHaveNet ? chartPoints : samplePoints
  const diskIoPoints = statsHaveDiskIo ? chartPoints : samplePoints

  const openstack = machine.openstack

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <MachineStatusDot
          className="size-2.5"
          health={machineHealth({
            enabled: machine.enabled,
            hasSample: sample !== undefined,
            failing,
          })}
        />
        <h1 className="text-lg font-semibold">{machineName(machine)}</h1>
        <Badge variant="secondary">{machine.ipv4}</Badge>
        <Badge variant="outline" className="font-mono">
          {machine.mac}
        </Badge>
        {!machine.enabled ? <Badge variant="secondary">disabled</Badge> : null}
        {machine.external ? (
          <Badge variant="outline">external</Badge>
        ) : !machine.openstack_found ? (
          <Badge variant="destructive">not in OpenStack</Badge>
        ) : null}
        {machine.credential_id ? null : (
          <Badge variant="destructive">no credential</Badge>
        )}
        <div className="ml-auto flex items-center gap-2">
          <LiveStatusIndicator status={status} />
          <MachineActions machine={machine} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
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
        <DiskIoCard io={snapshot?.diskIo ?? null} disks={snapshot?.disks} />
        <BandwidthCard latest={snapshot} />
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
              <Fact label="Subnet" value={openstack.subnet_name ?? "unknown"} />
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
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>OpenStack</CardTitle>
            <CardDescription>
              {machine.external
                ? `Registered as external: ${machine.ipv4} is outside the fleet, so its MAC and address are yours to set and the collector never moves them.`
                : `No record of ${machine.ipv4} in the lookup. It was deleted or moved in OpenStack since registration.`}{" "}
              Everything below comes from the agent, so any limit it does not
              report is shown as unknown.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

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
          data={usagePoints}
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
        <MetricsLineChart
          title="Disk throughput"
          description="Bucket average · live"
          data={diskIoPoints}
          range={range}
          valueFormatter={formatBytesRate}
          series={[
            {
              dataKey: "disk_read_bps",
              label: "Read",
              colorVar: "var(--chart-1)",
            },
            {
              dataKey: "disk_write_bps",
              label: "Write",
              colorVar: "var(--chart-4)",
            },
          ]}
        />
        <MetricsLineChart
          title="Disk operations"
          description="Bucket average · live"
          data={diskIoPoints}
          range={range}
          valueFormatter={formatIops}
          series={[
            {
              dataKey: "disk_read_iops",
              label: "Read",
              colorVar: "var(--chart-2)",
            },
            {
              dataKey: "disk_write_iops",
              label: "Write",
              colorVar: "var(--chart-5)",
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
    <div
      className="flex flex-col gap-4"
      aria-label="Loading machine details"
      aria-busy="true"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="size-2.5" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-32" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="size-7" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <MetricCardSkeleton key={index} />
        ))}
      </div>
      <OpenStackCardSkeleton />
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-8 w-44" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <ChartCardSkeleton key={index} />
        ))}
      </div>
    </div>
  )
}

function MetricCardSkeleton() {
  return (
    <Card className="h-full gap-2">
      <CardHeader>
        <Skeleton className="h-[22px] w-20" />
        <Skeleton className="h-5 w-28" />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center gap-2">
        <Skeleton className="mx-auto size-40 rounded-full" />
        <div className="flex flex-col items-center gap-0.5">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-36 max-w-full" />
        </div>
      </CardContent>
    </Card>
  )
}

function OpenStackCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-[22px] w-24" />
        <Skeleton className="h-5 w-72 max-w-full" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-0.5">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-24 max-w-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function ChartCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-[22px] w-36" />
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[280px] w-full" />
      </CardContent>
    </Card>
  )
}
