import { useFleetLiveMetrics } from "@/hooks/use-live-metrics"
import type { MetricSample } from "@/lib/api/types"
import { latestMetricsQueryOptions } from "@/lib/queries/metrics"
import { useQueryClient } from "@tanstack/react-query"
import * as React from "react"

export function useLiveMetricsSync(enabled: boolean): void {
  const { byMac } = useFleetLiveMetrics({ enabled })
  const queryClient = useQueryClient()

  const newestTs = newestSampleMs(byMac)
  const writtenTs = React.useRef(0)

  React.useEffect(() => {
    if (newestTs === 0 || newestTs === writtenTs.current) return
    writtenTs.current = newestTs
    queryClient.setQueryData(
      latestMetricsQueryOptions().queryKey,
      (previous: MetricSample[] | undefined) =>
        mergeLatest(previous ?? [], byMac)
    )
  }, [newestTs, byMac, queryClient])
}

function newestSampleMs(byMac: Record<string, MetricSample>): number {
  return Object.values(byMac).reduce(
    (newest, sample) => Math.max(newest, Date.parse(sample.ts)),
    0
  )
}

function mergeLatest(
  previous: MetricSample[],
  byMac: Record<string, MetricSample>
): MetricSample[] {
  const merged = new Map(previous.map((sample) => [sample.mac, sample]))
  for (const [mac, sample] of Object.entries(byMac)) {
    const known = merged.get(mac)
    if (!known || Date.parse(sample.ts) >= Date.parse(known.ts)) {
      merged.set(mac, sample)
    }
  }
  return [...merged.values()]
}
