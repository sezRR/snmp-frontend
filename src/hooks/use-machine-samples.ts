import { useFleetLiveMetrics } from "@/hooks/use-live-metrics"
import type { MetricSample } from "@/lib/api/types"
import { latestMetricsQueryOptions, samplesByMac } from "@/lib/queries/metrics"
import { useQuery } from "@tanstack/react-query"

export function useMachineSamples(): Record<string, MetricSample> {
  const { data: latest } = useQuery(latestMetricsQueryOptions())
  const { byMac } = useFleetLiveMetrics()
  return { ...samplesByMac(latest ?? []), ...byMac }
}
