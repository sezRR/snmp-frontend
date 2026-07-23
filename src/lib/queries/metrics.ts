import { api } from "@/lib/api/client"
import type { MetricsResponse } from "@/lib/api/types"
import { TIME_RANGES, type TimeRangeKey, resolveRange } from "@/lib/time-range"
import { queryOptions } from "@tanstack/react-query"

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export const metricsQueryOptions = (workerId: string, range: TimeRangeKey) =>
  queryOptions({
    queryKey: ["metrics", workerId, range],
    queryFn: () => {
      const { start, end, interval } = resolveRange(range)
      return api.get<MetricsResponse>("/api/v1/snmp/metrics", {
        worker_id: workerId,
        start,
        end,
        interval,
        agg: "avg",
      })
    },
    staleTime: 60_000,
    // Each refetch recomputes start/end, so the window slides forward and
    // stale buckets fall off the left edge; the SSE live tail covers the
    // gap between refetches.
    refetchInterval: clamp(TIME_RANGES[range].intervalMs, 30_000, 300_000),
  })
