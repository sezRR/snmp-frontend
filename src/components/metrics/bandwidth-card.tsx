import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { type ChartConfig, ChartContainer } from "@/components/ui/chart"
import { formatBps, formatPercent } from "@/lib/format"
import type { MetricsSnapshot } from "@/lib/metrics"
import { ArrowDown, ArrowUp } from "lucide-react"
import { Area, AreaChart } from "recharts"

const chartConfig = {
  rx_bps: { label: "In", color: "var(--chart-3)" },
  tx_bps: { label: "Out", color: "var(--chart-4)" },
} satisfies ChartConfig

interface BandwidthCardProps {
  latest: MetricsSnapshot | null
  history: MetricsSnapshot[]
}

export function BandwidthCard({ latest, history }: BandwidthCardProps) {
  const data = history.map((snapshot) => ({
    ts: snapshot.ts,
    rx_bps: snapshot.net.rxBps,
    tx_bps: snapshot.net.txBps,
  }))

  const rx = latest?.net.rxBps ?? null
  const tx = latest?.net.txBps ?? null
  const speed = latest?.net.speedBps ?? null
  const rxUtil = latest?.net.rxUtilPercent ?? null
  const txUtil = latest?.net.txUtilPercent ?? null

  return (
    <Card className="h-full gap-2">
      <CardHeader>
        <CardTitle>Bandwidth</CardTitle>
        <CardDescription>
          {speed === null
            ? "Live throughput"
            : `Live throughput · ${formatBps(speed)} link`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-3">
        <div className="flex items-baseline gap-6">
          <div className="flex items-center gap-1.5">
            <ArrowDown className="size-4 text-chart-3" />
            <span className="text-2xl font-bold tabular-nums">
              {rx === null ? "—" : formatBps(rx)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <ArrowUp className="size-4 text-chart-4" />
            <span className="text-2xl font-bold tabular-nums">
              {tx === null ? "—" : formatBps(tx)}
            </span>
          </div>
        </div>
        <ChartContainer config={chartConfig} className="h-16 w-full">
          <AreaChart
            data={data}
            margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
          >
            <Area
              dataKey="rx_bps"
              type="monotone"
              stroke="var(--color-rx_bps)"
              fill="var(--color-rx_bps)"
              fillOpacity={0.15}
              strokeWidth={2}
              isAnimationActive={false}
              connectNulls
              dot={false}
            />
            <Area
              dataKey="tx_bps"
              type="monotone"
              stroke="var(--color-tx_bps)"
              fill="var(--color-tx_bps)"
              fillOpacity={0.15}
              strokeWidth={2}
              isAnimationActive={false}
              connectNulls
              dot={false}
            />
          </AreaChart>
        </ChartContainer>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-chart-3" /> Inbound
            {rxUtil === null ? null : (
              <span className="tabular-nums">({formatPercent(rxUtil)})</span>
            )}
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-chart-4" /> Outbound
            {txUtil === null ? null : (
              <span className="tabular-nums">({formatPercent(txUtil)})</span>
            )}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
