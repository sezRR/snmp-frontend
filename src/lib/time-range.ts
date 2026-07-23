const MINUTE = 60_000
const HOUR = 60 * MINUTE

export const TIME_RANGES = {
  "15m": {
    label: "15 min",
    durationMs: 15 * MINUTE,
    interval: "30s",
    intervalMs: 30_000,
  },
  "1h": {
    label: "1 hour",
    durationMs: HOUR,
    interval: "1m",
    intervalMs: MINUTE,
  },
  "6h": {
    label: "6 hours",
    durationMs: 6 * HOUR,
    interval: "5m",
    intervalMs: 5 * MINUTE,
  },
  "24h": {
    label: "24 hours",
    durationMs: 24 * HOUR,
    interval: "15m",
    intervalMs: 15 * MINUTE,
  },
  "7d": {
    label: "7 days",
    durationMs: 7 * 24 * HOUR,
    interval: "1h",
    intervalMs: HOUR,
  },
} as const

export type TimeRangeKey = keyof typeof TIME_RANGES

export const timeRangeKeys = Object.keys(TIME_RANGES) as TimeRangeKey[]

export function resolveRange(key: TimeRangeKey): {
  start: string
  end: string
  interval: string
} {
  const { durationMs, interval } = TIME_RANGES[key]
  const end = Date.now()
  return {
    start: new Date(end - durationMs).toISOString(),
    end: new Date(end).toISOString(),
    interval,
  }
}
