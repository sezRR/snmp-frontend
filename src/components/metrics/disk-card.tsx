import { Button } from "@/components/ui/button"
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
import { ChevronDown, ChevronUp } from "lucide-react"
import * as React from "react"

function barColor(percent: number | null): string {
  if (percent === null) return "bg-muted-foreground/40"
  if (percent >= 90) return "bg-destructive"
  if (percent >= 80) return "bg-chart-4"
  return "bg-chart-5"
}

const COLLAPSED_MOUNTS = 5

export function DiskCard({ disks }: { disks: DiskReading[] }) {
  const [expanded, setExpanded] = React.useState(false)

  const ordered = [...disks].sort(
    (a, b) => (b.usedPercent ?? -1) - (a.usedPercent ?? -1)
  )
  const folded = ordered.length > COLLAPSED_MOUNTS && !expanded
  const shown = folded ? ordered.slice(0, COLLAPSED_MOUNTS) : ordered

  return (
    <Card className="h-full gap-2">
      <CardHeader>
        <CardTitle>Disk</CardTitle>
        <CardDescription>
          {disks.length === 0
            ? "No filesystem reported"
            : folded
              ? `${shown.length} of ${disks.length} mounts · fullest first`
              : `${disks.length} mount${disks.length === 1 ? "" : "s"}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center gap-3">
        {disks.length === 0 ? (
          <span className="text-sm text-muted-foreground">n/a</span>
        ) : (
          <div
            className={cn(
              "flex flex-col gap-3",
              !folded &&
                ordered.length > COLLAPSED_MOUNTS &&
                "max-h-72 overflow-y-auto pr-1"
            )}
          >
            {shown.map((disk) => (
              <div key={disk.mount} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    <span className="truncate font-mono text-xs">
                      {disk.mount}
                    </span>
                    {disk.device ? (
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {disk.device}
                      </span>
                    ) : null}
                  </span>
                  <span className="font-medium tabular-nums">
                    {disk.usedPercent === null
                      ? "n/a"
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
            ))}
          </div>
        )}
        {ordered.length > COLLAPSED_MOUNTS ? (
          <Button
            size="xs"
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={() => setExpanded(!expanded)}
          >
            {folded ? (
              <>
                <ChevronDown data-icon="inline-start" />
                Show all {ordered.length} mounts
              </>
            ) : (
              <>
                <ChevronUp data-icon="inline-start" />
                Show fewer
              </>
            )}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
