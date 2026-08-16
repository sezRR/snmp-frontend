import { useFleetLiveMetrics } from "@/hooks/use-live-metrics"
import type { MetricSample } from "@/lib/api/types"
import { latestMetricsQueryOptions } from "@/lib/queries/metrics"
import { useQueryClient } from "@tanstack/react-query"
import * as React from "react"

/**
 * Keeps the `/metrics/latest` cache fed from the fleet stream.
 *
 * That endpoint returns the newest sample per machine — which is exactly what
 * the stream delivers, a round earlier and without a request. Polling it on a
 * timer meant every page's read-out stepped on its own clock rather than the
 * collector's, so the cache is written here instead and the query's own
 * interval is left as the fallback for a stream that is down.
 *
 * Mounted once, in the authenticated layout — where `enabled` is false until
 * there is a session that may read metrics, since opening the stream costs a
 * ticket the backend would refuse.
 */
export function useLiveMetricsSync(enabled: boolean): void {
  const { byMac } = useFleetLiveMetrics({ enabled })
  const queryClient = useQueryClient()

  const newestTs = newestSampleMs(byMac)
  // byMac is replaced wholesale on every sample, so the newest timestamp is
  // what decides whether there is anything new to write.
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

/**
 * Stream samples win per machine, but a machine the stream has not reported —
 * one whose polls are failing — keeps whatever the last fetch knew about it.
 */
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
