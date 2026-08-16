import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatBytesRate, formatIops } from "@/lib/format"
import type { DiskIoReading, DiskReading } from "@/lib/metrics"
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react"

interface DiskIoCardProps {
  io: DiskIoReading | null
  /** Per-mount rates, listed when the collector breaks the total down. */
  disks?: DiskReading[]
}

const hasIo = (reading: DiskIoReading | null | undefined): boolean =>
  reading != null &&
  (reading.readBps !== null ||
    reading.writeBps !== null ||
    reading.readIops !== null ||
    reading.writeIops !== null)

/** Latest disk throughput and operation rate — history lives in the charts. */
export function DiskIoCard({ io, disks = [] }: DiskIoCardProps) {
  const reported = hasIo(io)
  // Only worth breaking out when more than one mount reports its own IO;
  // otherwise the rows would just repeat the total above them.
  const perMount = disks.filter(hasIo)
  const busiest = [...perMount].sort((a, b) => rateOf(b) - rateOf(a))

  return (
    <Card className="h-full gap-2">
      <CardHeader>
        <CardTitle>Disk I/O</CardTitle>
        <CardDescription>
          {reported ? "Live throughput" : "No disk I/O reported"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center gap-4">
        <Direction
          label="Read"
          icon={<ArrowDownToLine className="size-4 text-chart-1" />}
          bytesPerSecond={io?.readBps ?? null}
          iops={io?.readIops ?? null}
        />
        <Direction
          label="Write"
          icon={<ArrowUpFromLine className="size-4 text-chart-4" />}
          bytesPerSecond={io?.writeBps ?? null}
          iops={io?.writeIops ?? null}
        />
        {busiest.length > 1 ? (
          <div className="flex flex-col gap-1.5 border-t pt-3">
            {busiest.slice(0, 3).map((disk) => (
              <div
                key={disk.mount}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="truncate font-mono text-muted-foreground">
                  {disk.mount}
                </span>
                <span className="flex shrink-0 items-center gap-3 tabular-nums">
                  <span className="flex items-center gap-1">
                    <ArrowDownToLine className="size-3 text-chart-1" />
                    {formatRate(disk.readBps)}
                  </span>
                  <span className="flex items-center gap-1">
                    <ArrowUpFromLine className="size-3 text-chart-4" />
                    {formatRate(disk.writeBps)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

/** Sort key: total bytes moved, falling back to operations when only IOPS. */
function rateOf(disk: DiskReading): number {
  const bytes = (disk.readBps ?? 0) + (disk.writeBps ?? 0)
  if (bytes > 0) return bytes
  return (disk.readIops ?? 0) + (disk.writeIops ?? 0)
}

const formatRate = (value: number | null): string =>
  value === null ? "n/a" : formatBytesRate(value)

interface DirectionProps {
  label: string
  icon: React.ReactNode
  bytesPerSecond: number | null
  iops: number | null
}

function Direction({ label, icon, bytesPerSecond, iops }: DirectionProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className="text-xl font-bold tabular-nums">
          {formatRate(bytesPerSecond)}
        </span>
      </div>
      <span className="text-right text-xs text-muted-foreground tabular-nums">
        {iops === null ? "n/a" : formatIops(iops)}
      </span>
    </div>
  )
}
