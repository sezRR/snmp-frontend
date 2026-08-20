import { api } from "@/lib/api/client"
import {
  type MetricSample,
  metricCountSchema,
  metricSampleSchema,
  metricStatsRowSchema,
  purgeResultSchema,
} from "@/lib/api/types"
import { SCOPES, useHasScope } from "@/lib/auth/scopes"
import {
  type TimeRange,
  bucketDurationMs,
  isRelativeTime,
  resolveTimeRange,
} from "@/lib/time-range"
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { z } from "zod"

const sampleListSchema = z.array(metricSampleSchema)
const statsListSchema = z.array(metricStatsRowSchema)
const countListSchema = z.array(metricCountSchema)

export const metricsQueryKey = ["metrics"] as const

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/**
 * The most recent sample per machine — what the dashboard opens with, and the
 * fallback for machines the stream has not reported.
 *
 * useLiveMetricsSync writes each streamed sample into this cache, so the
 * interval below is not how the read-outs stay current; it is the safety net
 * for a stream that is down, and long enough not to duplicate its work.
 */
export const latestMetricsQueryOptions = () =>
  queryOptions({
    queryKey: [...metricsQueryKey, "latest"] as const,
    queryFn: () => api.get("/metrics/latest", { schema: sampleListSchema }),
    staleTime: 10_000,
    refetchInterval: 60_000,
  })

export const metricStatsQueryOptions = (mac: string, range: TimeRange) => {
  const { from, to } = range
  return queryOptions({
    queryKey: [...metricsQueryKey, "stats", mac, from, to] as const,
    queryFn: async () => {
      const window = resolveTimeRange({ from, to })
      const result = await api.getWithResponse("/metrics/stats", {
        params: {
          from: window.from.toISOString(),
          to: window.to.toISOString(),
          mac,
        },
        schema: statsListSchema,
      })
      const bucket = result.response.headers.get("X-Metrics-Bucket")
      if (!bucket) {
        throw new Error("Metrics response is missing X-Metrics-Bucket")
      }
      return {
        rows: result.data,
        intervalMs: bucketDurationMs(bucket),
        window: {
          from: window.from.toISOString(),
          to: window.to.toISOString(),
        },
      }
    },
    staleTime: 60_000,
    // Relative windows are resolved again on each request. Absolute windows are
    // snapshots and do not need polling after their first successful read.
    refetchInterval: (query) =>
      isRelativeTime(to)
        ? clamp(query.state.data?.intervalMs ?? 60_000, 30_000, 300_000)
        : false,
  })
}

export const metricCountsQueryOptions = () =>
  queryOptions({
    queryKey: [...metricsQueryKey, "counts"] as const,
    queryFn: () => api.get("/metrics/counts", { schema: countListSchema }),
    staleTime: 30_000,
  })

/** Row counts, for a caller that may read metric history at all. */
export function useMetricCountsQuery() {
  const allowed = useHasScope(SCOPES.metricsRead)
  return useQuery({ ...metricCountsQueryOptions(), enabled: allowed })
}

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
