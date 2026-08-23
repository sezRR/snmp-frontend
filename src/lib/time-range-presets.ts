import type { TimeRange } from "./time-range"

export interface TimeRangePreset {
  label: string
  range: TimeRange
}

export interface TimeRangePresetGroup {
  label: string
  presets: TimeRangePreset[]
}

export const TIME_RANGE_PRESET_GROUPS = [
  {
    label: "Recent",
    presets: [
      { label: "Last 5 minutes", range: { from: "now-5m", to: "now" } },
      { label: "Last 15 minutes", range: { from: "now-15m", to: "now" } },
      { label: "Last 30 minutes", range: { from: "now-30m", to: "now" } },
      { label: "Last 1 hour", range: { from: "now-1h", to: "now" } },
      { label: "Last 3 hours", range: { from: "now-3h", to: "now" } },
      { label: "Last 6 hours", range: { from: "now-6h", to: "now" } },
      { label: "Last 12 hours", range: { from: "now-12h", to: "now" } },
      { label: "Last 1 day", range: { from: "now-1d", to: "now" } },
    ],
  },
  {
    label: "Longer",
    presets: [
      { label: "Last 2 days", range: { from: "now-2d", to: "now" } },
      { label: "Last 7 days", range: { from: "now-7d", to: "now" } },
      { label: "Last 30 days", range: { from: "now-30d", to: "now" } },
      { label: "Last 3 months", range: { from: "now-3M", to: "now" } },
      { label: "Last 6 months", range: { from: "now-6M", to: "now" } },
      { label: "Last 1 year", range: { from: "now-1y", to: "now" } },
      { label: "Last 2 years", range: { from: "now-2y", to: "now" } },
    ],
  },
  {
    label: "Calendar periods",
    presets: [
      { label: "Today", range: { from: "now/d", to: "now" } },
      { label: "Yesterday", range: { from: "now-1d/d", to: "now/d" } },
      {
        label: "Day before yesterday",
        range: { from: "now-2d/d", to: "now-1d/d" },
      },
      { label: "This week", range: { from: "now/w", to: "now" } },
      { label: "Previous week", range: { from: "now-1w/w", to: "now/w" } },
      { label: "This month", range: { from: "now/M", to: "now" } },
      { label: "Previous month", range: { from: "now-1M/M", to: "now/M" } },
      { label: "This year", range: { from: "now/y", to: "now" } },
      { label: "Previous year", range: { from: "now-1y/y", to: "now/y" } },
    ],
  },
] satisfies TimeRangePresetGroup[]

export function findTimeRangePreset(
  range: TimeRange
): TimeRangePreset | undefined {
  const from = range.from.trim()
  const to = range.to.trim()
  for (const group of TIME_RANGE_PRESET_GROUPS) {
    for (const preset of group.presets) {
      if (preset.range.from === from && preset.range.to === to) return preset
    }
  }
  return undefined
}
