import {
  metricTooltipFormatter,
  metricTooltipLabelFormatter,
} from "@/components/metrics/metric-tooltip"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { type BucketWindow, withBucketGaps } from "@/lib/live-buckets"
import type { ChartPoint } from "@/lib/metrics"
import { useMemo } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

export interface SeriesDef {
  dataKey: keyof Omit<ChartPoint, "ts">
  label: string
  colorVar: string
}

interface MetricsLineChartProps {
  title: string
  description?: string
  data: ChartPoint[]
  series: SeriesDef[]
  intervalMs: number
  queryWindow: BucketWindow
  valueFormatter: (value: number) => string
  yDomain?: [number, number]
}

function tickFormatterFor(rangeMs: number) {
  const timeOnly: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }
  const dayAndTime: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }
  const options = rangeMs >= 24 * 60 * 60 * 1000 ? dayAndTime : timeOnly
  return (value: string) => new Date(value).toLocaleString(undefined, options)
}

interface DotRenderProps {
  cx?: number
  cy?: number
  index?: number
}

function isolatedPointDot(
  data: ChartPoint[],
  dataKey: SeriesDef["dataKey"],
  color: string
) {
  const reported = (index: number) =>
    index >= 0 && index < data.length && data[index][dataKey] !== null

  return ({ cx, cy, index }: DotRenderProps) => {
    const at = index ?? -1
    if (
      cx === undefined ||
      cy === undefined ||
      reported(at - 1) ||
      reported(at + 1)
    ) {
      return <g />
    }
    return <circle cx={cx} cy={cy} r={2.5} fill={color} />
  }
}

export function MetricsLineChart({
  title,
  description,
  data,
  series,
  intervalMs,
  queryWindow,
  valueFormatter,
  yDomain,
}: MetricsLineChartProps) {
  const rangeMs = Date.parse(queryWindow.to) - Date.parse(queryWindow.from)
  const chartConfig = Object.fromEntries(
    series.map((s) => [s.dataKey, { label: s.label, color: s.colorVar }])
  ) satisfies ChartConfig

  const seriesLabels = Object.fromEntries(
    series.map((s) => [s.dataKey, s.label])
  )

  const xTickFormatter = tickFormatterFor(rangeMs)

  const points = useMemo(
    () => withBucketGaps(data, intervalMs, queryWindow),
    [data, intervalMs, queryWindow]
  )
  const hasData = points.some((point) =>
    series.some((item) => typeof point[item.dataKey] === "number")
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <AreaChart data={points} margin={{ left: 4, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="ts"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={48}
                tickFormatter={xTickFormatter}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                width={56}
                domain={yDomain ?? ["auto", "auto"]}
                tickFormatter={(value: number) => valueFormatter(value)}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={metricTooltipLabelFormatter}
                    formatter={metricTooltipFormatter(
                      seriesLabels,
                      valueFormatter
                    )}
                  />
                }
              />
              {series.map((s) => (
                <Area
                  key={s.dataKey}
                  dataKey={s.dataKey}
                  type="monotone"
                  stroke={`var(--color-${s.dataKey})`}
                  fill={`var(--color-${s.dataKey})`}
                  fillOpacity={0.1}
                  strokeWidth={2}
                  dot={isolatedPointDot(
                    points,
                    s.dataKey,
                    `var(--color-${s.dataKey})`
                  )}
                  activeDot={{ r: 3 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
            No data in this time range.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
