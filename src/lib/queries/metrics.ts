import { api } from "@/lib/api/client"
import {
  type MetricSample,
  metricCountSchema,
  metricSampleSchema,
  metricStatsRowSchema,
  purgeResultSchema,
} from "@/lib/api/types"
import { TIME_RANGES, type TimeRangeKey } from "@/lib/time-range"
import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { z } from "zod"

const sampleListSchema = z.array(metricSampleSchema)
const statsListSchema = z.array(metricStatsRowSchema)
const countListSchema = z.array(metricCountSchema)

export const metricsQueryKey = ["metrics"] as const

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/** The most recent sample per machine — what the dashboard opens with. */
export const latestMetricsQueryOptions = () =>
  queryOptions({
    queryKey: [...metricsQueryKey, "latest"] as const,
    queryFn: () => api.get("/metrics/latest", { schema: sampleListSchema }),
    staleTime: 10_000,
    refetchInterval: 30_000,
  })

export const metricStatsQueryOptions = (
  mac: string | undefined,
  range: TimeRangeKey
) =>
  queryOptions({
    queryKey: [...metricsQueryKey, "stats", mac ?? "all", range] as const,
    queryFn: () => {
      const { hours, bucket } = TIME_RANGES[range]
      return api.get("/metrics/stats", {
        params: { hours, bucket, mac },
        schema: statsListSchema,
      })
    },
    staleTime: 60_000,
    // Each refetch re-anchors the window on now, so stale buckets fall off the
    // left edge; the SSE tail covers the gap between refetches.
    refetchInterval: clamp(TIME_RANGES[range].intervalMs, 30_000, 300_000),
  })

export const recentSamplesQueryOptions = (mac: string, limit = 200) =>
  queryOptions({
    queryKey: [...metricsQueryKey, "samples", mac, limit] as const,
    queryFn: () =>
      api.get("/metrics", { params: { mac, limit }, schema: sampleListSchema }),
    staleTime: 30_000,
  })

export const metricCountsQueryOptions = () =>
  queryOptions({
    queryKey: [...metricsQueryKey, "counts"] as const,
    queryFn: () => api.get("/metrics/counts", { schema: countListSchema }),
    staleTime: 30_000,
  })

export function useInvalidateMetrics() {
  const queryClient = useQueryClient()
  return () => void queryClient.invalidateQueries({ queryKey: metricsQueryKey })
}

export function usePurgeMachineMetricsMutation() {
  const invalidate = useInvalidateMetrics()
  return useMutation({
    mutationFn: ({ mac, before }: { mac: string; before?: string }) =>
      api.delete(`/machines/${encodeURIComponent(mac)}/metrics`, {
        params: { before },
        schema: purgeResultSchema,
      }),
    onSuccess: invalidate,
  })
}

export function usePurgeAllMetricsMutation() {
  const invalidate = useInvalidateMetrics()
  return useMutation({
    mutationFn: ({ before }: { before?: string } = {}) =>
      api.delete("/metrics", {
        params: { confirm: true, before },
        schema: purgeResultSchema,
      }),
    onSuccess: invalidate,
  })
}

export function samplesByMac(
  samples: MetricSample[]
): Record<string, MetricSample> {
  return Object.fromEntries(samples.map((sample) => [sample.mac, sample]))
}

/** /metrics/counts is loosely typed; read whichever key the backend used. */
export function readSampleCount(count: {
  samples?: number | null
  rows?: number | null
  count?: number | null
}): number | null {
  return count.samples ?? count.rows ?? count.count ?? null
}

export function readLatestTs(count: {
  latest?: string | null
  latest_ts?: string | null
}): string | null {
  return count.latest ?? count.latest_ts ?? null
}
