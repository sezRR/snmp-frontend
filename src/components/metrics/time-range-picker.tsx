import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { type TimeRangeKey, timeRangeKeys } from "@/lib/time-range"

interface TimeRangePickerProps {
  value: TimeRangeKey
  onChange: (value: TimeRangeKey) => void
}

export function TimeRangePicker({ value, onChange }: TimeRangePickerProps) {
  return (
    <ToggleGroup
      variant="outline"
      spacing={0}
      value={[value]}
      onValueChange={(next: unknown[]) => {
        const key = next[0] as TimeRangeKey | undefined
        if (key) onChange(key)
      }}
    >
      {timeRangeKeys.map((key) => (
        <ToggleGroupItem key={key} value={key} aria-label={`Last ${key}`}>
          {key}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
