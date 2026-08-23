import type { ChartPoint, MetricsSnapshot } from "./metrics.ts"
import { snapshotToPoint } from "./metrics.ts"

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

const MAX_FILLED_BUCKETS = 2000

export interface BucketWindow {
  from: string
  to: string
}

function windowBucketBounds(
  window: BucketWindow,
  intervalMs: number
): { first: number; last: number } | undefined {
  const fromMs = Date.parse(window.from)
  const toMs = Date.parse(window.to)
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return undefined
  return {
    first: Math.floor(fromMs / intervalMs) * intervalMs,
    last: Math.floor((toMs - 1) / intervalMs) * intervalMs,
  }
}

function emptyBucket(ms: number): ChartPoint {
  return { ts: new Date(ms).toISOString(), ...emptyMetrics() }
}

function padToWindow(
  points: ChartPoint[],
  intervalMs: number,
  window: BucketWindow
): ChartPoint[] {
  if (points.length === 0) return points
  const bounds = windowBucketBounds(window, intervalMs)
  if (!bounds) return points

  const leading: ChartPoint[] = []
  const firstPointMs = Date.parse(points[0].ts)
  if (Number.isFinite(firstPointMs)) {
    for (
      let ts = bounds.first;
      ts < firstPointMs && leading.length < MAX_FILLED_BUCKETS;
      ts += intervalMs
    ) {
      leading.push(emptyBucket(ts))
    }
  }

  const trailing: ChartPoint[] = []
  const lastPointMs = Date.parse(points[points.length - 1].ts)
  if (Number.isFinite(lastPointMs)) {
    for (
      let ts = lastPointMs + intervalMs;
      ts <= bounds.last && trailing.length < MAX_FILLED_BUCKETS;
      ts += intervalMs
    ) {
      trailing.push(emptyBucket(ts))
    }
  }

  if (leading.length === 0 && trailing.length === 0) return points
  return [...leading, ...points, ...trailing]
}

export function withBucketGaps(
  points: ChartPoint[],
  intervalMs: number,
  window?: BucketWindow
): ChartPoint[] {
  if (intervalMs <= 0) return points
  const filled = fillInteriorGaps(points, intervalMs)
  return window ? padToWindow(filled, intervalMs, window) : filled
}

function fillInteriorGaps(
  points: ChartPoint[],
  intervalMs: number
): ChartPoint[] {
  if (points.length < 2) return points

  const filled: ChartPoint[] = [points[0]]
  for (let i = 1; i < points.length; i += 1) {
    const point = points[i]
    const prevMs = Date.parse(filled[filled.length - 1].ts)
    const currentMs = Date.parse(point.ts)
    if (Number.isFinite(prevMs) && currentMs - prevMs > intervalMs * 1.5) {
      const missing = Math.min(
        Math.round((currentMs - prevMs) / intervalMs) - 1,
        MAX_FILLED_BUCKETS
      )
      for (let step = 1; step <= missing; step += 1) {
        filled.push(emptyBucket(prevMs + step * intervalMs))
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

export function mergeLiveIntoPoints(
  points: ChartPoint[],
  samples: MetricsSnapshot[],
  intervalMs: number
): ChartPoint[] {
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
