import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatPercent, formatUsage } from "@/lib/format"
import type { DiskReading } from "@/lib/metrics"
import { cn } from "@/lib/utils"

/** Amber at 80%, red at 90% — the usual "act now" thresholds for a filesystem. */
function barColor(percent: number | null): string {
  if (percent === null) return "bg-muted-foreground/40"
  if (percent >= 90) return "bg-destructive"
  if (percent >= 80) return "bg-chart-4"
  return "bg-chart-5"
}

export function DiskCard({ disks }: { disks: DiskReading[] }) {
  return (
    <Card className="h-full gap-2">
      <CardHeader>
        <CardTitle>Disk</CardTitle>
        <CardDescription>
          {disks.length === 0
            ? "No filesystem reported"
            : `${disks.length} mount${disks.length === 1 ? "" : "s"}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center gap-3">
        {disks.length === 0 ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : (
          disks.map((disk) => (
            <div key={disk.mount} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-mono text-xs">{disk.mount}</span>
                <span className="font-medium tabular-nums">
                  {disk.usedPercent === null
                    ? "—"
                    : formatPercent(disk.usedPercent)}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width]",
                    barColor(disk.usedPercent)
                  )}
                  style={{
                    width: `${Math.min(100, Math.max(0, disk.usedPercent ?? 0))}%`,
                  }}
                />
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatUsage(disk.usedBytes, disk.totalBytes)}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
