import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { type ChartConfig, ChartContainer } from "@/components/ui/chart"
import type { LiveMetrics } from "@/lib/api/types"
import { formatBps } from "@/lib/format"
import { ArrowDown, ArrowUp } from "lucide-react"
import { Area, AreaChart } from "recharts"

const chartConfig = {
  bandwidth_in_bps: { label: "In", color: "var(--chart-3)" },
  bandwidth_out_bps: { label: "Out", color: "var(--chart-4)" },
} satisfies ChartConfig

interface BandwidthCardProps {
  latest: LiveMetrics | null
  history: LiveMetrics[]
}

export function BandwidthCard({ latest, history }: BandwidthCardProps) {
  return (
    <Card className="gap-2">
      <CardHeader>
        <CardTitle>Bandwidth</CardTitle>
        <CardDescription>Live throughput</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-3">
        <div className="flex items-baseline gap-6">
          <div className="flex items-center gap-1.5">
            <ArrowDown className="size-4 text-chart-3" />
            <span className="text-2xl font-bold tabular-nums">
              {latest ? formatBps(latest.bandwidth_in_bps) : "—"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <ArrowUp className="size-4 text-chart-4" />
            <span className="text-2xl font-bold tabular-nums">
              {latest ? formatBps(latest.bandwidth_out_bps) : "—"}
            </span>
          </div>
        </div>
        <ChartContainer config={chartConfig} className="h-16 w-full">
          <AreaChart
            data={history}
            margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
          >
            <Area
              dataKey="bandwidth_in_bps"
              type="monotone"
              stroke="var(--color-bandwidth_in_bps)"
              fill="var(--color-bandwidth_in_bps)"
              fillOpacity={0.15}
              strokeWidth={2}
              isAnimationActive={false}
              dot={false}
            />
            <Area
              dataKey="bandwidth_out_bps"
              type="monotone"
              stroke="var(--color-bandwidth_out_bps)"
              fill="var(--color-bandwidth_out_bps)"
              fillOpacity={0.15}
              strokeWidth={2}
              isAnimationActive={false}
              dot={false}
            />
          </AreaChart>
        </ChartContainer>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-chart-3" /> Inbound
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-chart-4" /> Outbound
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
