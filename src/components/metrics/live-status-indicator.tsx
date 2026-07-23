import type { LiveStatus } from "@/hooks/use-live-metrics"
import { cn } from "@/lib/utils"

const statusConfig: Record<LiveStatus, { label: string; dotClass: string }> = {
  connecting: { label: "Connecting", dotClass: "bg-muted-foreground" },
  open: { label: "Live", dotClass: "bg-chart-2" },
  reconnecting: { label: "Reconnecting", dotClass: "bg-chart-4" },
  error: { label: "Disconnected", dotClass: "bg-destructive" },
}

export function LiveStatusIndicator({ status }: { status: LiveStatus }) {
  const { label, dotClass } = statusConfig[status]
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={cn(
          "size-2 rounded-full",
          dotClass,
          status === "open" && "animate-pulse"
        )}
      />
      {label}
    </span>
  )
}
