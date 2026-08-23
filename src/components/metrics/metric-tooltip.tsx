import type { ChartTooltipContent } from "@/components/ui/chart"
import { formatDateTime } from "@/lib/format"
import type * as React from "react"

type ContentProps = React.ComponentProps<typeof ChartTooltipContent>
type Formatter = NonNullable<ContentProps["formatter"]>

export const metricTooltipLabelFormatter = (value: unknown): string =>
  formatDateTime(String(value))

export function metricTooltipFormatter(
  labels: Record<string, string>,
  valueFormatter: (value: number) => string
): Formatter {
  return (value, name, item) => (
    <div className="flex w-full items-center gap-2">
      <span
        className="size-2 shrink-0 rounded-xs"
        style={{ background: item.color }}
      />
      <span className="text-muted-foreground">
        {labels[String(name)] ?? String(name)}
      </span>
      <span className="ml-auto font-mono font-medium tabular-nums">
        {typeof value === "number" ? valueFormatter(value) : "n/a"}
      </span>
    </div>
  )
}
