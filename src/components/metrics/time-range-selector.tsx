import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import {
  TIME_EXPRESSION_EXAMPLE,
  type TimeRange,
  formatAbsoluteTime,
  resolveTimeExpression,
} from "@/lib/time-range"
import {
  TIME_RANGE_PRESET_GROUPS,
  type TimeRangePresetGroup,
  findTimeRangePreset,
} from "@/lib/time-range-presets"
import {
  CalendarRangeIcon,
  CheckIcon,
  ChevronDownIcon,
  Clock3Icon,
} from "lucide-react"
import { useId, useState } from "react"
import type { DateRange } from "react-day-picker"
import { flushSync } from "react-dom"

interface TimeRangeSelectorProps extends TimeRange {
  onApply: (range: TimeRange) => void
}

type RangeErrors = Partial<Record<keyof TimeRange, string>>

function validateRange(range: TimeRange): RangeErrors {
  const now = new Date()
  const errors: RangeErrors = {}
  let resolvedFrom: Date | undefined
  let resolvedTo: Date | undefined

  try {
    resolvedFrom = resolveTimeExpression(range.from, now)
  } catch (error) {
    errors.from =
      error instanceof Error ? error.message : TIME_EXPRESSION_EXAMPLE
  }
  try {
    resolvedTo = resolveTimeExpression(range.to, now)
  } catch (error) {
    errors.to = error instanceof Error ? error.message : TIME_EXPRESSION_EXAMPLE
  }
  if (resolvedFrom && resolvedTo && resolvedFrom >= resolvedTo) {
    errors.to = "To must be after From."
  }
  return errors
}

function closeThenApply(close: () => void, applyWindow: () => void) {
  flushSync(close)
  applyWindow()
}

function tryResolve(value: string): Date | undefined {
  try {
    return resolveTimeExpression(value)
  } catch {
    return undefined
  }
}

export function TimeRangeSelector({
  from,
  to,
  onApply,
}: TimeRangeSelectorProps) {
  const id = useId()
  const [draftFrom, setDraftFrom] = useState(from)
  const [draftTo, setDraftTo] = useState(to)
  const [errors, setErrors] = useState<RangeErrors>({})
  const [pickerOpen, setPickerOpen] = useState(false)

  function apply() {
    const next = { from: draftFrom.trim(), to: draftTo.trim() }
    const nextErrors = validateRange(next)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length === 0) {
      closeThenApply(
        () => setPickerOpen(false),
        () => onApply(next)
      )
    }
  }

  function applyPreset(range: TimeRange) {
    setDraftFrom(range.from)
    setDraftTo(range.to)
    setErrors({})
    onApply(range)
  }

  function setRange(range: TimeRange) {
    setDraftFrom(range.from)
    setDraftTo(range.to)
    setErrors({})
  }

  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(event) => {
        event.preventDefault()
        apply()
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        <TimeExpressionField
          id={`${id}-from`}
          label="From"
          value={draftFrom}
          invalid={Boolean(errors.from)}
          onChange={(value) => {
            setDraftFrom(value)
            if (errors.from) {
              setErrors((current) => ({ ...current, from: undefined }))
            }
          }}
        />
        <TimeExpressionField
          id={`${id}-to`}
          label="To"
          value={draftTo}
          invalid={Boolean(errors.to)}
          onChange={(value) => {
            setDraftTo(value)
            if (errors.to) {
              setErrors((current) => ({ ...current, to: undefined }))
            }
          }}
        />
        <RangePicker
          id={`${id}-picker`}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          from={draftFrom}
          to={draftTo}
          onChange={setRange}
        />
        <QuickRanges applied={{ from, to }} onSelect={applyPreset} />
        <Button type="submit">Apply</Button>
      </div>
      {errors.from || errors.to ? (
        <div className="flex flex-col gap-0.5 text-xs text-destructive">
          {errors.from ? (
            <p id={`${id}-from-error`} role="alert">
              From: {errors.from}
            </p>
          ) : null}
          {errors.to ? (
            <p id={`${id}-to-error`} role="alert">
              To: {errors.to}
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
  )
}

interface TimeExpressionFieldProps {
  id: string
  label: string
  value: string
  invalid: boolean
  onChange: (value: string) => void
}

function TimeExpressionField({
  id,
  label,
  value,
  invalid,
  onChange,
}: TimeExpressionFieldProps) {
  return (
    <Field data-invalid={invalid} className="w-36 gap-1.5 sm:w-44">
      <FieldLabel htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </FieldLabel>
      <Input
        id={id}
        value={value}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-error` : undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder="now-1h"
        title={TIME_EXPRESSION_EXAMPLE}
        className="font-mono"
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  )
}

interface RangePickerProps {
  id: string
  open: boolean
  onOpenChange: (open: boolean) => void
  from: string
  to: string
  onChange: (range: TimeRange) => void
}

function atMidnight(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function withTime(date: Date, time: string): Date | undefined {
  const [hours, minutes] = time.split(":").map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return undefined
  const result = new Date(date)
  result.setHours(hours, minutes, 0, 0)
  return result
}

function timeValue(date: Date | undefined): string {
  if (!date) return ""
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function RangePicker({
  id,
  open,
  onOpenChange,
  from,
  to,
  onChange,
}: RangePickerProps) {
  const fromDate = tryResolve(from)
  const toDate = tryResolve(to)
  const selected: DateRange | undefined = fromDate
    ? { from: fromDate, to: toDate }
    : undefined

  function selectRange(next: DateRange | undefined) {
    if (!next?.from) return
    onChange({
      from: formatAbsoluteTime(atMidnight(next.from)),
      to: next.to ? formatAbsoluteTime(atMidnight(next.to)) : to,
    })
  }

  function changeTime(edge: keyof TimeRange, value: string) {
    const anchor = edge === "from" ? fromDate : toDate
    if (!anchor || !value) return
    const next = withTime(anchor, value)
    if (!next) return
    onChange({ from, to, [edge]: formatAbsoluteTime(next) })
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={<Button id={id} type="button" variant="outline" />}
      >
        <CalendarRangeIcon data-icon="inline-start" />
        Pick range
      </PopoverTrigger>
      {open ? (
        <PopoverContent
          className="w-auto max-w-[calc(100vw-2rem)] gap-0 p-0"
          align="end"
        >
          <PopoverHeader className="p-3">
            <PopoverTitle>Absolute range</PopoverTitle>
            <PopoverDescription>
              Pick a start and end day, then adjust the times. Browser local
              time.
            </PopoverDescription>
          </PopoverHeader>
          <Separator />
          <Calendar
            mode="range"
            selected={selected}
            defaultMonth={fromDate}
            numberOfMonths={2}
            captionLayout="dropdown"
            fixedWeeks
            timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
            className="p-3"
            onSelect={selectRange}
          />
          <Separator />
          <div className="flex flex-wrap items-end justify-between gap-4 p-3">
            <div className="flex gap-4">
              <TimeField
                id={`${id}-from-time`}
                label="From time"
                value={timeValue(fromDate)}
                disabled={!fromDate}
                onChange={(value) => changeTime("from", value)}
              />
              <TimeField
                id={`${id}-to-time`}
                label="To time"
                value={timeValue(toDate)}
                disabled={!toDate}
                onChange={(value) => changeTime("to", value)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Done
            </Button>
          </div>
        </PopoverContent>
      ) : null}
    </Popover>
  )
}

interface TimeFieldProps {
  id: string
  label: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
}

function TimeField({ id, label, value, disabled, onChange }: TimeFieldProps) {
  return (
    <Field className="w-32 gap-1.5">
      <FieldLabel htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </FieldLabel>
      <Input
        id={id}
        type="time"
        step="60"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  )
}

function QuickRanges({
  applied,
  onSelect,
}: {
  applied: TimeRange
  onSelect: (range: TimeRange) => void
}) {
  const [open, setOpen] = useState(false)
  const recentGroups = TIME_RANGE_PRESET_GROUPS.slice(0, 2)
  const calendarGroup = TIME_RANGE_PRESET_GROUPS[2]
  const active = findTimeRangePreset(applied)

  function select(range: TimeRange) {
    closeThenApply(
      () => setOpen(false),
      () => onSelect(range)
    )
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="min-w-44 justify-between"
          />
        }
      >
        <Clock3Icon data-icon="inline-start" />
        <span className="truncate">
          {active ? active.label : "Custom range"}
        </span>
        <ChevronDownIcon data-icon="inline-end" />
      </DropdownMenuTrigger>
      {open ? (
        <DropdownMenuContent
          align="end"
          className="w-96 max-w-[calc(100vw-2rem)]"
        >
          <div className="grid grid-cols-2 gap-1">
            {recentGroups.map((group) => (
              <PresetGroup
                key={group.label}
                group={group}
                activeLabel={active?.label}
                onSelect={select}
              />
            ))}
          </div>
          <DropdownMenuSeparator />
          <PresetGroup
            group={calendarGroup}
            activeLabel={active?.label}
            onSelect={select}
            columns={2}
          />
        </DropdownMenuContent>
      ) : null}
    </DropdownMenu>
  )
}

function PresetGroup({
  group,
  activeLabel,
  onSelect,
  columns = 1,
}: {
  group: TimeRangePresetGroup
  activeLabel?: string
  onSelect: (range: TimeRange) => void
  columns?: 1 | 2
}) {
  return (
    <DropdownMenuGroup
      className={columns === 2 ? "grid grid-cols-2" : undefined}
    >
      <DropdownMenuLabel className={columns === 2 ? "col-span-2" : undefined}>
        {group.label}
      </DropdownMenuLabel>
      {group.presets.map((preset) => {
        const active = preset.label === activeLabel
        return (
          <DropdownMenuItem
            key={preset.label}
            aria-current={active ? "true" : undefined}
            className={active ? "font-medium" : undefined}
            onClick={() => onSelect(preset.range)}
          >
            {preset.label}
            {active ? <CheckIcon className="ml-auto size-3.5" /> : null}
          </DropdownMenuItem>
        )
      })}
    </DropdownMenuGroup>
  )
}
