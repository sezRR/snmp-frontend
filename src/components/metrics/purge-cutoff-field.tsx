import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import * as React from "react"

const PRESETS: { label: string; days: number }[] = [
  { label: "1 day", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
]

function startOfDaysAgo(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(0, 0, 0, 0)
  return date
}

interface PurgeCutoffFieldProps {
  id: string
  value: Date | undefined
  onChange: (value: Date | undefined) => void
  disabled?: boolean
  description?: string
}

export function PurgeCutoffField({
  id,
  value,
  onChange,
  disabled,
  description,
}: PurgeCutoffFieldProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Field>
      <FieldLabel htmlFor={id}>Older than (optional)</FieldLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              disabled={disabled}
              className="w-full justify-start font-normal"
            >
              <CalendarIcon data-icon="inline-start" />
              {value ? format(value, "PPP") : "Every stored sample"}
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            autoFocus
            captionLayout="dropdown"
            selected={value}
            disabled={{ after: new Date() }}
            onSelect={(date) => {
              onChange(date)
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map((preset) => (
          <Button
            key={preset.label}
            type="button"
            size="xs"
            variant="outline"
            disabled={disabled}
            onClick={() => onChange(startOfDaysAgo(preset.days))}
          >
            Older than {preset.label}
          </Button>
        ))}
        {value ? (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            disabled={disabled}
            onClick={() => onChange(undefined)}
          >
            Clear
          </Button>
        ) : null}
      </div>
      <FieldDescription>
        {value
          ? (description ??
            "Only samples stamped before this date are deleted.")
          : "Leave empty to delete every stored sample."}
      </FieldDescription>
    </Field>
  )
}
