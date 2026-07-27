import { api } from "@/lib/api/client"
import {
  type CollectorMachineStat,
  type CollectorStatus,
  cacheFlushedSchema,
  cacheStatsSchema,
  collectorStatusSchema,
  forceTickResultSchema,
  serverInfoSchema,
} from "@/lib/api/types"
import { machinesQueryKey } from "@/lib/queries/machines"
import { metricsQueryKey } from "@/lib/queries/metrics"
import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { z } from "zod"

const serverListSchema = z.array(serverInfoSchema)

export const adminQueryKey = ["admin"] as const

/**
 * Bounds on the self-tuned poll. The collector runs at 5s, and fetching the
 * status body once a round would be a request per round for counters that
 * change slowly — "last tick" is read off the stream instead (useLastTickAt),
 * so this only has to keep the tallies and the loop's own state honest.
 */
const MIN_STATUS_POLL_MS = 15_000
const MAX_STATUS_POLL_MS = 60_000

export const collectorStatusQueryOptions = () =>
  queryOptions({
    queryKey: [...adminQueryKey, "collector"] as const,
    queryFn: () =>
      api.get("/admin/collector", { schema: collectorStatusSchema }),
    refetchInterval: (query) => {
      const seconds = query.state.data?.interval_seconds
      if (typeof seconds !== "number" || seconds <= 0) return MAX_STATUS_POLL_MS
      return Math.min(
        MAX_STATUS_POLL_MS,
        Math.max(MIN_STATUS_POLL_MS, seconds * 1000)
      )
    },
  })

export const cacheStatsQueryOptions = () =>
  queryOptions({
    queryKey: [...adminQueryKey, "openstack", "cache"] as const,
    queryFn: () =>
      api.get("/admin/openstack/cache", { schema: cacheStatsSchema }),
    refetchInterval: 60_000,
  })

/** The fleet as the lookup sees it — i.e. the addresses that can be registered. */
export const cachedServersQueryOptions = () =>
  queryOptions({
    queryKey: [...adminQueryKey, "openstack", "servers"] as const,
    queryFn: () =>
      api.get("/admin/openstack/servers", { schema: serverListSchema }),
    staleTime: 60_000,
  })

export function useForceTickMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api.post("/admin/collector/tick", { schema: forceTickResultSchema }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: metricsQueryKey })
      void queryClient.invalidateQueries({ queryKey: adminQueryKey })
    },
  })
}

export function useFlushCacheMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api.post("/admin/openstack/cache/flush", { schema: cacheFlushedSchema }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminQueryKey })
      void queryClient.invalidateQueries({ queryKey: machinesQueryKey })
    },
  })
}

export interface CollectorMachineHealth {
  mac: string
  success: number | null
  failure: number | null
  lastError: string | null
}

/** The status body reports per-machine counters as either a list or a map. */
export function collectorMachineHealth(
  status: CollectorStatus | undefined
): Record<string, CollectorMachineHealth> {
  const entries: [string, CollectorMachineStat][] = Array.isArray(
    status?.machines
  )
    ? status.machines.map((stat) => [stat.mac ?? "", stat])
    : Object.entries(status?.machines ?? {})

  const health: Record<string, CollectorMachineHealth> = {}
  for (const [key, stat] of entries) {
    const mac = stat.mac ?? key
    if (!mac) continue
    health[mac] = {
      mac,
      success: stat.success ?? stat.successes ?? null,
      failure: stat.failure ?? stat.failures ?? null,
      lastError: stat.last_error ?? null,
    }
  }
  return health
}
