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
