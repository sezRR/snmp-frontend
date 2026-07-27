import { cn } from "@/lib/utils"

/**
 * How fresh a sample has to be before a machine counts as reporting. The
 * collector polls every 5 seconds, so this is several missed rounds — enough
 * slack for a slow round or a reconnecting stream, short enough that a machine
 * that has genuinely gone quiet does not keep a green dot for minutes.
 */
const STALE_AFTER_MS = 30_000

export type MachineHealth = "reporting" | "stale" | "failing" | "disabled"

export function machineHealth({
  enabled,
  latestTs,
  failing,
  now,
}: {
  enabled: boolean
  latestTs: string | null | undefined
  failing?: boolean
  /** From useClock(), so freshness is judged against one shared instant. */
  now: number
}): MachineHealth {
  if (!enabled) return "disabled"
  if (failing) return "failing"
  if (!latestTs) return "stale"
  return now - Date.parse(latestTs) <= STALE_AFTER_MS ? "reporting" : "stale"
}

const healthClass: Record<MachineHealth, string> = {
  reporting: "bg-chart-2",
  stale: "bg-chart-4",
  failing: "bg-destructive",
  disabled: "bg-muted-foreground/40",
}

const healthLabel: Record<MachineHealth, string> = {
  reporting: "Reporting",
  stale: "No recent samples",
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
