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
import type { MetricsPoint } from "@/lib/api/types"
import type { TimeRangeKey } from "@/lib/time-range"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

interface SeriesDef {
  dataKey: keyof Omit<MetricsPoint, "ts">
  label: string
  colorVar: string
}

interface MetricsLineChartProps {
  title: string
  description?: string
  data: MetricsPoint[]
  series: SeriesDef[]
  range: TimeRangeKey
  valueFormatter: (value: number) => string
  yDomain?: [number, number]
}

function tickFormatterFor(range: TimeRangeKey) {
  const timeOnly: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
  }
  const dayAndTime: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    hour: "2-digit",
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
                  labelFormatter={(value) =>
                    new Date(String(value)).toLocaleString()
                  }
                  formatter={(value, name, item) => (
                    <div className="flex w-full items-center gap-2">
                      <span
                        className="size-2 shrink-0 rounded-xs"
                        style={{ background: item.color }}
                      />
                      <span className="text-muted-foreground">
                        {chartConfig[name as keyof typeof chartConfig]?.label ??
                          name}
                      </span>
                      <span className="ml-auto font-mono font-medium tabular-nums">
                        {typeof value === "number"
                          ? valueFormatter(value)
                          : "—"}
                      </span>
                    </div>
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
