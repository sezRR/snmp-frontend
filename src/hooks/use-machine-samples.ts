import { useFleetLiveMetrics } from "@/hooks/use-live-metrics"
import type { MetricSample } from "@/lib/api/types"
import { latestMetricsQueryOptions, samplesByMac } from "@/lib/queries/metrics"
import { useQuery } from "@tanstack/react-query"

/**
 * Newest sample per MAC: /metrics/latest fills the gap until the fleet SSE
 * connection delivers its first event, and live events win from then on. Both
 * sources are shared singletons, so calling this from several components costs
 * nothing extra.
 */
export function useMachineSamples(): Record<string, MetricSample> {
  const { data: latest } = useQuery(latestMetricsQueryOptions())
  const { byMac } = useFleetLiveMetrics()
  return { ...samplesByMac(latest ?? []), ...byMac }
}
