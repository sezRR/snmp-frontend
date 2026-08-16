import { cn } from "@/lib/utils"

export type MachineHealth = "reporting" | "unsampled" | "failing" | "disabled"

/**
 * Whether a machine is answering, judged without reference to any clock.
 *
 * This used to age the newest sample against the browser's clock and call
 * anything older than half a minute stale. On a fleet where NTP is optional
 * that measured the disagreement between two clocks rather than the health of a
 * machine: a guest a few minutes fast stayed green forever, one a few minutes
 * slow went amber while answering every round. The collector already knows
 * whether the last poll succeeded and says so per machine, which is the same
 * question answered by the side that actually asked it.
 */
export function machineHealth({
  enabled,
  hasSample,
  failing,
}: {
  enabled: boolean
  /** Whether any sample has been seen for this machine at all. */
  hasSample: boolean
  /** From the collector's own per-machine counters. */
  failing?: boolean
}): MachineHealth {
  if (!enabled) return "disabled"
  if (failing) return "failing"
  return hasSample ? "reporting" : "unsampled"
}

const healthClass: Record<MachineHealth, string> = {
  reporting: "bg-chart-2",
  unsampled: "bg-chart-4",
  failing: "bg-destructive",
  disabled: "bg-muted-foreground/40",
}

const healthLabel: Record<MachineHealth, string> = {
  reporting: "Reporting",
  unsampled: "No samples yet",
  failing: "Collector failing",
  disabled: "Polling disabled",
}

export function MachineStatusDot({
  health,
  className,
}: {
  health: MachineHealth
  className?: string
}) {
  return (
    <span
      title={healthLabel[health]}
      aria-label={healthLabel[health]}
      className={cn(
        "size-2 shrink-0 rounded-full",
        healthClass[health],
        className
      )}
    />
  )
}

export { healthLabel as machineHealthLabel }
