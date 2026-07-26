import { Button } from "@/components/ui/button"
import { SidebarFooter } from "@/components/ui/sidebar"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/client"
import { formatDuration, formatRelativeTime } from "@/lib/format"
import {
  cacheStatsQueryOptions,
  collectorMachineHealth,
  collectorStatusQueryOptions,
  useFlushCacheMutation,
  useForceTickMutation,
} from "@/lib/queries/admin"
import { cn } from "@/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

/**
 * Loop health and the OpenStack lookup cache, with the two admin actions that
 * unstick a demo: force a collection round, and drop the cache so the next
 * read repopulates it.
 */
export function CollectorHealthFooter() {
  const { data: collector, isError: collectorFailed } = useQuery(
    collectorStatusQueryOptions()
  )
  const { data: cache } = useQuery(cacheStatsQueryOptions())
  const tick = useForceTickMutation()
  const flush = useFlushCacheMutation()

  const health = Object.values(collectorMachineHealth(collector))
  const failing = health.filter((machine) => (machine.failure ?? 0) > 0).length
  const running = collector?.running ?? !collectorFailed

  const handleTick = () => {
    tick.mutate(undefined, {
      onSuccess: (result) => {
        const polled = result.polled ?? null
        toast.success(
          polled === null
            ? "Collection round finished"
            : `Polled ${polled} machine${polled === 1 ? "" : "s"}`
        )
      },
      onError: (error) => toast.error(errorMessage(error, "Force tick failed")),
    })
  }

  const handleFlush = () => {
    flush.mutate(undefined, {
      onSuccess: (result) =>
        toast.success(`Dropped ${result.dropped_servers} cached servers`),
      onError: (error) =>
        toast.error(errorMessage(error, "Cache flush failed")),
    })
  }

  return (
    <SidebarFooter className="group-data-[collapsible=icon]:hidden">
      <div className="flex flex-col gap-2 rounded-lg border p-2 text-xs">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              collectorFailed
                ? "bg-destructive"
                : running
                  ? "bg-chart-2"
                  : "bg-chart-4"
            )}
          />
          <span className="font-medium">Collector</span>
          <span className="ml-auto text-muted-foreground">
            {collectorFailed ? "unreachable" : running ? "running" : "stopped"}
          </span>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-muted-foreground">
          {collector?.last_tick_at ? (
            <>
              <dt>Last tick</dt>
              <dd className="text-right tabular-nums">
                {formatRelativeTime(collector.last_tick_at)}
              </dd>
            </>
          ) : null}
          {typeof collector?.interval_seconds === "number" ? (
            <>
              <dt>Interval</dt>
              <dd className="text-right tabular-nums">
                {formatDuration(collector.interval_seconds)}
              </dd>
            </>
          ) : null}
          {health.length > 0 ? (
            <>
              <dt>Failing</dt>
              <dd
                className={cn(
                  "text-right tabular-nums",
                  failing > 0 && "text-destructive"
                )}
              >
                {failing} / {health.length}
              </dd>
            </>
          ) : null}
        </dl>

        <Button
          size="xs"
          variant="outline"
          className="w-full"
          disabled={tick.isPending}
          onClick={handleTick}
        >
          {tick.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <RefreshCw data-icon="inline-start" />
          )}
          Force tick
        </Button>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border p-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-medium">OpenStack cache</span>
          <span className="ml-auto text-muted-foreground tabular-nums">
            {cache?.populated ? `${cache.servers} servers` : "empty"}
          </span>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-muted-foreground">
          {typeof cache?.age_seconds === "number" ? (
            <>
              <dt>Age</dt>
              <dd className="text-right tabular-nums">
                {formatDuration(cache.age_seconds)} /{" "}
                {formatDuration(cache.ttl_seconds)}
              </dd>
            </>
          ) : null}
          {cache ? (
            <>
              <dt>Hits</dt>
              <dd className="text-right tabular-nums">
                {cache.hits} / {cache.hits + cache.misses}
              </dd>
            </>
          ) : null}
        </dl>
        {cache?.last_error ? (
          <p className="text-destructive">{cache.last_error}</p>
        ) : null}
        <Button
          size="xs"
          variant="outline"
          className="w-full"
          disabled={flush.isPending}
          onClick={handleFlush}
        >
          {flush.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Trash2 data-icon="inline-start" />
          )}
          Flush cache
        </Button>
      </div>
    </SidebarFooter>
  )
}
