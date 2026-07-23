import { BandwidthCard } from "@/components/metrics/bandwidth-card"
import { LiveStatusIndicator } from "@/components/metrics/live-status-indicator"
import { MetricsLineChart } from "@/components/metrics/metrics-line-chart"
import { RadialMetricCard } from "@/components/metrics/radial-metric-card"
import { TimeRangePicker } from "@/components/metrics/time-range-picker"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useLiveMetrics } from "@/hooks/use-live-metrics"
import { formatBps, formatPercent } from "@/lib/format"
import { mergeLiveIntoPoints } from "@/lib/live-buckets"
import { metricsQueryOptions } from "@/lib/queries/metrics"
import { workerQueryOptions } from "@/lib/queries/workers"
import { TIME_RANGES, type TimeRangeKey, timeRangeKeys } from "@/lib/time-range"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

const searchSchema = z.object({
  range: z
    .enum(timeRangeKeys as [TimeRangeKey, ...TimeRangeKey[]])
    .default("1h"),
})

export const Route = createFileRoute("/workers/$workerId")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ range: search.range }),
  loader: ({ context, params, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(workerQueryOptions(params.workerId)),
      context.queryClient.ensureQueryData(
        metricsQueryOptions(params.workerId, deps.range)
      ),
    ]),
  pendingComponent: WorkerDetailSkeleton,
  component: WorkerDetailPage,
})

function WorkerDetailPage() {
  const { workerId } = Route.useParams()
  const { range } = Route.useSearch()
  const navigate = Route.useNavigate()

  const { data: worker } = useSuspenseQuery(workerQueryOptions(workerId))
  const { data: metrics } = useSuspenseQuery(
    metricsQueryOptions(workerId, range)
  )
  const { latest, history, status } = useLiveMetrics(workerId)

  // Historic buckets + live SSE tail aggregated into the same interval, so
  // the line charts keep moving between refetches.
  const chartPoints = mergeLiveIntoPoints(
    metrics.points,
    history,
    TIME_RANGES[range].intervalMs
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">{worker.name ?? worker.ip}</h1>
        <Badge variant="secondary">{worker.ip}</Badge>
        <Badge variant="secondary">SNMP {worker.snmp_version}</Badge>
        <div className="ml-auto">
          <LiveStatusIndicator status={status} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <RadialMetricCard
          title="CPU"
          description="Live utilization"
          value={latest?.cpu_percent ?? null}
          colorVar="var(--chart-1)"
        />
        <RadialMetricCard
          title="RAM"
          description="Live utilization"
          value={latest?.ram_percent ?? null}
          colorVar="var(--chart-2)"
        />
        <BandwidthCard latest={latest} history={history} />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">History</h2>
        <TimeRangePicker
          value={range}
          onChange={(next) => {
            void navigate({ search: { range: next } })
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <MetricsLineChart
          title="CPU & RAM"
          description="Average utilization per interval · live"
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
          ]}
        />
        <MetricsLineChart
          title="Bandwidth"
          description="Average throughput per interval · live"
          data={chartPoints}
          range={range}
          valueFormatter={formatBps}
          series={[
            {
              dataKey: "bandwidth_in_bps",
              label: "Inbound",
              colorVar: "var(--chart-3)",
            },
            {
              dataKey: "bandwidth_out_bps",
              label: "Outbound",
              colorVar: "var(--chart-4)",
            },
          ]}
        />
      </div>
    </div>
  )
}

function WorkerDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  )
}
