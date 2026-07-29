import type { ChartPoint, MetricsSnapshot } from "@/lib/metrics"
import { snapshotToPoint } from "@/lib/metrics"

type MetricKey = Exclude<keyof ChartPoint, "ts">

const METRIC_KEYS: MetricKey[] = [
  "cpu_percent",
  "ram_percent",
  "disk_percent",
  "disk_read_bps",
  "disk_write_bps",
  "disk_read_iops",
  "disk_write_iops",
  "net_rx_bps",
  "net_tx_bps",
]

const emptyMetrics = (): Omit<ChartPoint, "ts"> =>
  Object.fromEntries(METRIC_KEYS.map((key) => [key, null])) as Omit<
    ChartPoint,
    "ts"
  >

// An outage produces no stats rows at all, so without this the chart draws a
// straight line from before the gap to after it, and the X axis — which plots
// points evenly, not by time — hides how long the machine was silent. Filling
// the missing buckets with nulls restores both the break and the spacing.
const MAX_FILLED_BUCKETS = 2000

export function withBucketGaps(
  points: ChartPoint[],
  intervalMs: number
): ChartPoint[] {
  if (points.length < 2 || intervalMs <= 0) return points

  const filled: ChartPoint[] = [points[0]]
  for (let i = 1; i < points.length; i += 1) {
    const point = points[i]
    const prevMs = Date.parse(filled[filled.length - 1].ts)
    const currentMs = Date.parse(point.ts)
    // Half an interval of slack: buckets are floored to the interval, but a
    // live tail bucket can land a few ms off and must not read as a gap.
    if (Number.isFinite(prevMs) && currentMs - prevMs > intervalMs * 1.5) {
      const missing = Math.min(
        Math.round((currentMs - prevMs) / intervalMs) - 1,
        MAX_FILLED_BUCKETS
      )
      for (let step = 1; step <= missing; step += 1) {
        filled.push({
          ts: new Date(prevMs + step * intervalMs).toISOString(),
          ...emptyMetrics(),
        })
      }
    }
    filled.push(point)
  }
  return filled
}

type Accumulator = Record<MetricKey, { sum: number; count: number }>

const emptyAccumulator = (): Accumulator =>
  Object.fromEntries(
    METRIC_KEYS.map((key) => [key, { sum: 0, count: 0 }])
  ) as Accumulator

// Extends bucketed historic points with live SSE samples, aggregated into the
// same interval so the X axis keeps an even time step. Only buckets strictly
// after the last historic point are appended; the newest (partial) bucket
// re-averages as samples arrive. A metric missing from a sample contributes
// nothing rather than counting as zero — the same rule the backend's stats
// aggregate uses.
export function mergeLiveIntoPoints(
  points: ChartPoint[],
  samples: MetricsSnapshot[],
  intervalMs: number
): ChartPoint[] {
  // The stats endpoint makes no ordering promise, and a chart plots points in
  // array order — an unsorted response draws the axis as 1pm, 2pm, 1pm. Sort
  // before anything else so the cutoff below is really the newest bucket.
  const history = [...points].sort(
    (a, b) => Date.parse(a.ts) - Date.parse(b.ts)
  )
  if (samples.length === 0) return history

  const lastHistoricMs =
    history.length > 0
      ? Date.parse(history[history.length - 1].ts)
      : Number.NEGATIVE_INFINITY

  const buckets = new Map<number, Accumulator>()
  for (const sample of samples) {
    const bucketMs = Math.floor(Date.parse(sample.ts) / intervalMs) * intervalMs
    if (bucketMs <= lastHistoricMs) continue
    const acc = buckets.get(bucketMs) ?? emptyAccumulator()
    const point = snapshotToPoint(sample)
    for (const key of METRIC_KEYS) {
      const value = point[key]
      if (value === null) continue
      acc[key].sum += value
      acc[key].count += 1
    }
    buckets.set(bucketMs, acc)
  }

  if (buckets.size === 0) return history

  const liveTail = [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([bucketMs, acc]): ChartPoint => {
      const averaged = Object.fromEntries(
        METRIC_KEYS.map((key) => [
          key,
          acc[key].count === 0 ? null : acc[key].sum / acc[key].count,
        ])
      ) as Omit<ChartPoint, "ts">
      return { ts: new Date(bucketMs).toISOString(), ...averaged }
    })

  return [...history, ...liveTail]
}
