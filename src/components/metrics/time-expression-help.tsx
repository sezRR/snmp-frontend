import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { ChevronDownIcon, CircleHelpIcon } from "lucide-react"
import { useState } from "react"

interface Example {
  expression: string
  meaning: string
}

const OPERATORS: Example[] = [
  { expression: "now", meaning: "This instant." },
  { expression: "now-30m", meaning: "Thirty minutes back. − subtracts." },
  { expression: "now+1h", meaning: "An hour ahead. + adds." },
  {
    expression: "now/d",
    meaning: "Today at 00:00. / rounds down to the start of the unit.",
  },
  {
    expression: "now-1d/d",
    meaning: "Yesterday at 00:00: step back a day, then round down.",
  },
  {
    expression: "2026-08-18 09:30",
    meaning: "A fixed instant, in your browser's local time.",
  },
]

const UNITS: Example[] = [
  { expression: "s", meaning: "second" },
  { expression: "m", meaning: "minute" },
  { expression: "h", meaning: "hour" },
  { expression: "d", meaning: "day" },
  { expression: "w", meaning: "week, starting Monday" },
  { expression: "M", meaning: "month" },
  { expression: "y", meaning: "year" },
]

function Expression({ children }: { children: string }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
      {children}
    </code>
  )
}

export function TimeExpressionHelp({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <CollapsibleTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 text-muted-foreground"
          />
        }
      >
        <CircleHelpIcon data-icon="inline-start" />
        Time expression syntax
        <ChevronDownIcon
          data-icon="inline-end"
          className={cn("transition-transform", open && "rotate-180")}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 grid gap-6 rounded-lg border border-border bg-card p-4 text-sm md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Building blocks
            </h3>
            <dl className="grid gap-1.5">
              {OPERATORS.map((item) => (
                <div
                  key={item.expression}
                  className="grid grid-cols-[9.5rem_minmax(0,1fr)] items-baseline gap-3"
                >
                  <dt>
                    <Expression>{item.expression}</Expression>
                  </dt>
                  <dd className="text-muted-foreground">{item.meaning}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Units
            </h3>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 md:grid-cols-1">
              {UNITS.map((item) => (
                <div
                  key={item.expression}
                  className="grid grid-cols-[2rem_minmax(0,1fr)] items-baseline gap-3"
                >
                  <dt>
                    <Expression>{item.expression}</Expression>
                  </dt>
                  <dd className="text-muted-foreground">{item.meaning}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-muted-foreground">
              Case matters: <Expression>m</Expression> is minutes,{" "}
              <Expression>M</Expression> is months.
            </p>
          </section>

          <footer className="flex flex-col gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground md:col-span-2">
            <p>
              The window runs from <span className="text-foreground">From</span>{" "}
              up to but not including{" "}
              <span className="text-foreground">To</span>. Each point is stamped
              with the start of its bucket, so the last point on the axis covers
              the span that ends at To.
            </p>
            <p>
              A To of <Expression>now</Expression> keeps rolling and takes the
              live stream; any other To is a fixed snapshot.
            </p>
          </footer>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
