import { cn } from "@/lib/utils"

export type MachineHealth = "reporting" | "unsampled" | "failing" | "disabled"

export function machineHealth({
  enabled,
  hasSample,
  failing,
}: {
  enabled: boolean
  hasSample: boolean
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
