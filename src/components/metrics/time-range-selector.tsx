import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  TIME_EXPRESSION_EXAMPLE,
  type TimeRange,
  resolveTimeExpression,
} from "@/lib/time-range"
import { useState } from "react"

interface TimeRangeSelectorProps extends TimeRange {
  onApply: (range: TimeRange) => void
}

type RangeErrors = Partial<Record<keyof TimeRange, string>>

export function TimeRangeSelector({
  from,
  to,
  onApply,
}: TimeRangeSelectorProps) {
  const [draftFrom, setDraftFrom] = useState(from)
  const [draftTo, setDraftTo] = useState(to)
  const [errors, setErrors] = useState<RangeErrors>({})

  function apply() {
    const next = { from: draftFrom.trim(), to: draftTo.trim() }
    const now = new Date()
    const nextErrors: RangeErrors = {}
    let resolvedFrom: Date | undefined
    let resolvedTo: Date | undefined

    try {
      resolvedFrom = resolveTimeExpression(next.from, now)
    } catch (error) {
      nextErrors.from =
        error instanceof Error ? error.message : TIME_EXPRESSION_EXAMPLE
    }
    try {
      resolvedTo = resolveTimeExpression(next.to, now)
    } catch (error) {
      nextErrors.to =
        error instanceof Error ? error.message : TIME_EXPRESSION_EXAMPLE
    }
    if (resolvedFrom && resolvedTo && resolvedFrom >= resolvedTo) {
      nextErrors.to = "To must be after From."
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length === 0) onApply(next)
  }

  return (
    <form
      className="flex w-full flex-col gap-1.5 sm:w-auto"
      onSubmit={(event) => {
        event.preventDefault()
        apply()
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1 sm:flex-none">
          <Label
            htmlFor="history-from"
            className="text-xs text-muted-foreground"
          >
            From
          </Label>
          <Input
            id="history-from"
            value={draftFrom}
            aria-invalid={Boolean(errors.from)}
            aria-describedby={errors.from ? "history-from-error" : undefined}
            autoComplete="off"
            spellCheck={false}
            className="font-mono sm:w-44"
            onChange={(event) => {
              setDraftFrom(event.target.value)
              if (errors.from)
                setErrors((current) => ({ ...current, from: undefined }))
            }}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1 sm:flex-none">
          <Label htmlFor="history-to" className="text-xs text-muted-foreground">
            To
          </Label>
          <Input
            id="history-to"
            value={draftTo}
            aria-invalid={Boolean(errors.to)}
            aria-describedby={errors.to ? "history-to-error" : undefined}
            autoComplete="off"
            spellCheck={false}
            className="font-mono sm:w-44"
            onChange={(event) => {
              setDraftTo(event.target.value)
              if (errors.to)
                setErrors((current) => ({ ...current, to: undefined }))
            }}
          />
        </div>
        <Button type="submit">Apply</Button>
      </div>
      {errors.from ? (
        <p
          id="history-from-error"
          role="alert"
          className="text-xs text-destructive"
        >
          From: {errors.from}
        </p>
      ) : null}
      {errors.to ? (
        <p
          id="history-to-error"
          role="alert"
          className="text-xs text-destructive"
        >
          To: {errors.to}
        </p>
      ) : null}
      {!errors.from && !errors.to ? (
        <p className="text-xs text-muted-foreground">
          {TIME_EXPRESSION_EXAMPLE}
        </p>
      ) : null}
    </form>
  )
}
