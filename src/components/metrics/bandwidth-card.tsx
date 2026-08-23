import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatBps, formatBytes, formatPercent } from "@/lib/format"
import type { MetricsSnapshot } from "@/lib/metrics"
import { cn } from "@/lib/utils"
import { ArrowDown, ArrowUp } from "lucide-react"

interface BandwidthCardProps {
  latest: MetricsSnapshot | null
}

export function BandwidthCard({ latest }: BandwidthCardProps) {
  const net = latest?.net ?? null
  const speed = net?.speedBps ?? null

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
      <CardContent className="flex flex-1 flex-col justify-center gap-4">
        <Direction
          label="Inbound"
          icon={<ArrowDown className="size-4 text-chart-3" />}
          bps={net?.rxBps ?? null}
          utilPercent={net?.rxUtilPercent ?? null}
          barClass="bg-chart-3"
        />
        <Direction
          label="Outbound"
          icon={<ArrowUp className="size-4 text-chart-4" />}
          bps={net?.txBps ?? null}
          utilPercent={net?.txUtilPercent ?? null}
          barClass="bg-chart-4"
        />
      </CardContent>
    </Card>
  )
}

interface DirectionProps {
  label: string
  icon: React.ReactNode
  bps: number | null
  utilPercent: number | null
  barClass: string
}

function Direction({
  label,
  icon,
  bps,
  utilPercent,
  barClass,
}: DirectionProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className="text-xl font-bold tabular-nums">
          {bps === null ? "n/a" : formatBps(bps)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-[width]", barClass)}
          style={{
            width: `${Math.min(100, Math.max(0, utilPercent ?? 0))}%`,
          }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">
        {utilPercent === null ? "n/a" : `${formatPercent(utilPercent)} of link`}
        {bps === null ? "" : ` · ${formatBytes(bps / 8)}/s`}
      </span>
    </div>
  )
}
