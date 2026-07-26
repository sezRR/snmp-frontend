const MINUTE = 60_000
const HOUR = 60 * MINUTE

// `hours` and `bucket` map straight onto /metrics/stats — the bucket string is
// a Postgres interval handed to time_bucket, so it must stay in that syntax.
export const TIME_RANGES = {
  "15m": {
    label: "15 min",
    hours: 0.25,
    bucket: "30 seconds",
    intervalMs: 30_000,
    durationMs: 15 * MINUTE,
  },
  "1h": {
    label: "1 hour",
    hours: 1,
    bucket: "1 minute",
    intervalMs: MINUTE,
    durationMs: HOUR,
  },
  "6h": {
    label: "6 hours",
    hours: 6,
    bucket: "5 minutes",
    intervalMs: 5 * MINUTE,
    durationMs: 6 * HOUR,
  },
  "24h": {
    label: "24 hours",
    hours: 24,
    bucket: "15 minutes",
    intervalMs: 15 * MINUTE,
    durationMs: 24 * HOUR,
  },
  "7d": {
    label: "7 days",
    hours: 168,
    bucket: "1 hour",
    intervalMs: HOUR,
    durationMs: 7 * 24 * HOUR,
  },
} as const

export type TimeRangeKey = keyof typeof TIME_RANGES

export const timeRangeKeys = Object.keys(TIME_RANGES) as TimeRangeKey[]
