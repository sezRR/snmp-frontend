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
import type { ChartPoint } from "@/lib/metrics"
import type { TimeRangeKey } from "@/lib/time-range"
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
  range: TimeRangeKey
  valueFormatter: (value: number) => string
  yDomain?: [number, number]
}

function tickFormatterFor(range: TimeRangeKey) {
  // 24-hour, like every other timestamp in the app: axis ticks are read at a
  // glance and an AM/PM suffix is both wider and easier to misread.
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
  const options = range === "7d" || range === "24h" ? dayAndTime : timeOnly
  return (value: string) => new Date(value).toLocaleString(undefined, options)
}

export function MetricsLineChart({
  title,
  description,
  data,
  series,
  range,
  valueFormatter,
  yDomain,
}: MetricsLineChartProps) {
  const chartConfig = Object.fromEntries(
    series.map((s) => [s.dataKey, { label: s.label, color: s.colorVar }])
  ) satisfies ChartConfig

  const seriesLabels = Object.fromEntries(
    series.map((s) => [s.dataKey, s.label])
  )

  const xTickFormatter = tickFormatterFor(range)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <AreaChart data={data} margin={{ left: 4, right: 12 }}>
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
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ))}
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
