import type { LiveMetrics, MetricsPoint } from "@/lib/api/types"

interface Accumulator {
  cpu: number
  ram: number
  bwIn: number
  bwOut: number
  count: number
}

// Extends bucketed historic points with live SSE samples, aggregated into the
// same interval so the X axis keeps an even time step. Only buckets strictly
// after the last historic point are appended; the newest (partial) bucket
// re-averages as samples arrive.
export function mergeLiveIntoPoints(
  points: MetricsPoint[],
  samples: LiveMetrics[],
  intervalMs: number
): MetricsPoint[] {
  if (samples.length === 0) return points

  const lastHistoricMs =
    points.length > 0
      ? Date.parse(points[points.length - 1].ts)
      : Number.NEGATIVE_INFINITY

  const buckets = new Map<number, Accumulator>()
  for (const sample of samples) {
    const bucketMs = Math.floor(Date.parse(sample.ts) / intervalMs) * intervalMs
    if (bucketMs <= lastHistoricMs) continue
    const acc = buckets.get(bucketMs) ?? {
      cpu: 0,
      ram: 0,
      bwIn: 0,
      bwOut: 0,
      count: 0,
    }
    acc.cpu += sample.cpu_percent
    acc.ram += sample.ram_percent
    acc.bwIn += sample.bandwidth_in_bps
    acc.bwOut += sample.bandwidth_out_bps
    acc.count += 1
    buckets.set(bucketMs, acc)
  }

  if (buckets.size === 0) return points

  const liveTail = [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([bucketMs, acc]): MetricsPoint => ({
      ts: new Date(bucketMs).toISOString(),
      cpu_percent: acc.cpu / acc.count,
      ram_percent: acc.ram / acc.count,
      bandwidth_in_bps: acc.bwIn / acc.count,
      bandwidth_out_bps: acc.bwOut / acc.count,
    }))

  return [...points, ...liveTail]
}
