import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useLiveMetrics } from "@/hooks/use-live-metrics"
import type { Worker } from "@/lib/api/types"
import { formatBps, formatPercent } from "@/lib/format"
import { Link } from "@tanstack/react-router"
import { ArrowDown, ArrowUp } from "lucide-react"

const statusVariant: Record<
  Worker["status"],
  "default" | "destructive" | "secondary"
> = {
  up: "default",
  down: "destructive",
  unknown: "secondary",
}

export function WorkerCard({ worker }: { worker: Worker }) {
  const { latest } = useLiveMetrics(worker.id, { windowSize: 1 })

  return (
    <Link
      to="/workers/$workerId"
      params={{ workerId: worker.id }}
      className="block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="h-full transition-colors hover:bg-accent/50">
        <CardHeader>
          <CardTitle>{worker.name ?? worker.ip}</CardTitle>
          <CardDescription>{worker.ip}</CardDescription>
          <CardAction>
            <Badge variant={statusVariant[worker.status]}>
              {worker.status}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">CPU</dt>
              <dd className="font-medium tabular-nums">
                {latest ? formatPercent(latest.cpu_percent) : "—"}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">RAM</dt>
              <dd className="font-medium tabular-nums">
                {latest ? formatPercent(latest.ram_percent) : "—"}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">Bandwidth</dt>
              <dd className="flex flex-col font-medium tabular-nums">
                <span className="flex items-center gap-1">
                  <ArrowDown className="size-3 text-chart-3" />
                  {latest ? formatBps(latest.bandwidth_in_bps) : "—"}
                </span>
                <span className="flex items-center gap-1">
                  <ArrowUp className="size-3 text-chart-4" />
                  {latest ? formatBps(latest.bandwidth_out_bps) : "—"}
                </span>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </Link>
  )
}
