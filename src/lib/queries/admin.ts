import { api } from "@/lib/api/client"
import {
  type CollectorMachineStat,
  type CollectorStatus,
  type ForceTickResult,
  cacheFlushedSchema,
  cacheStatsSchema,
  collectorStatusSchema,
  forceTickResultSchema,
  serverInfoSchema,
} from "@/lib/api/types"
import { useHasScope } from "@/lib/auth/rbac"
import { SCOPES } from "@/lib/auth/scopes"
import { machinesQueryKey } from "@/lib/queries/machines"
import { metricsQueryKey } from "@/lib/queries/metrics"
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { z } from "zod"

const serverListSchema = z.array(serverInfoSchema)

export const adminQueryKey = ["admin"] as const

/**
 * Bounds on the self-tuned poll, which otherwise runs at the collector's own
 * cadence. A round that polls nothing successfully puts no sample on the
 * stream, so for a failing fleet this endpoint is the only evidence a round
 * happened at all — the tallies, the failure reasons and "last tick" all go
 * stale together if it is fetched more slowly than the loop ticks.
 */
const MIN_STATUS_POLL_MS = 5_000
const MAX_STATUS_POLL_MS = 60_000

/**
 * The period the next round is due after. The loop reports what it actually
 * achieved as well as what it was configured for, and the achieved figure is
 * the one a countdown should be measured against.
 */
export function collectorIntervalSeconds(
  status: CollectorStatus | undefined
): number | null {
  const seconds = status?.effective_interval_seconds ?? status?.interval_seconds
  return typeof seconds === "number" && seconds > 0 ? seconds : null
}

export const collectorStatusQueryOptions = () =>
  queryOptions({
    queryKey: [...adminQueryKey, "collector"] as const,
    queryFn: () =>
      api.get("/admin/collector", { schema: collectorStatusSchema }),
    refetchInterval: (query) => {
      const seconds = collectorIntervalSeconds(query.state.data)
      if (seconds === null) return MAX_STATUS_POLL_MS
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

// Everything under /admin needs `admin:read`, which a metrics-only role does
// not have. Polling it anyway would beat on a 403 every few seconds and leave
// a permanent error in the cache, so each of these is gated on the scope and
// the UI treats "not allowed" the same as "not known yet": the poll-health
// dots go quiet, the panels do not render.

export function useCollectorStatusQuery() {
  const allowed = useHasScope(SCOPES.adminRead)
  return useQuery({ ...collectorStatusQueryOptions(), enabled: allowed })
}

export function useCacheStatsQuery() {
  const allowed = useHasScope(SCOPES.adminRead)
  return useQuery({ ...cacheStatsQueryOptions(), enabled: allowed })
}

/** The registerable addresses, which only the OpenStack cache knows. */
export function useCachedServersQuery({ enabled = true } = {}) {
  const allowed = useHasScope(SCOPES.adminRead)
  return useQuery({
    ...cachedServersQueryOptions(),
    enabled: enabled && allowed,
  })
}

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
  okCount: number | null
  failCount: number | null
  lastOkAt: string | null
  lastErrorAt: string | null
  lastError: string | null
  /** Whether the *most recent* poll failed, not whether one ever has. */
  failing: boolean
}

/**
 * Is this machine failing right now?
 *
 * A lifetime failure count cannot answer that — a machine that failed once an
 * hour ago and has answered every round since would stay red forever. The two
 * outcome timestamps can: whichever is newer is what the last round did. Only
 * a payload carrying neither falls back to the counter, and then a machine
 * with nothing but failures is the one case that is unambiguous.
 */
function isFailing(stat: CollectorMachineStat, failCount: number | null) {
  const okAt = stat.last_ok ?? stat.last_success_at ?? null
  const errorAt = stat.last_error_at ?? null

  if (errorAt && okAt) return Date.parse(errorAt) > Date.parse(okAt)
  if (errorAt) return true
  if (okAt) return false
  return (failCount ?? 0) > 0
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
    const okCount = stat.ok_count ?? stat.success ?? stat.successes ?? null
    const failCount = stat.fail_count ?? stat.failure ?? stat.failures ?? null
    health[mac] = {
      mac,
      okCount,
      failCount,
      lastOkAt: stat.last_ok ?? stat.last_success_at ?? null,
      lastErrorAt: stat.last_error_at ?? null,
      lastError: stat.last_error ?? null,
      failing: isFailing(stat, failCount),
    }
  }
  return health
}

/** What a forced round did, however the backend chose to phrase it. */
export function tickSummary(result: ForceTickResult): {
  stored: number | null
  failed: number | null
  polled: number | null
} {
  const stored = result.stored ?? result.succeeded ?? null
  const failed = result.failed ?? null
  const polled =
    result.polled ??
    (stored === null && failed === null ? null : (stored ?? 0) + (failed ?? 0))
  return { stored, failed, polled }
}
