import { CredentialsAdminCard } from "@/components/admin/credentials-card"
import { PurgeCutoffField } from "@/components/metrics/purge-cutoff-field"
import { MachineStatusDot } from "@/components/sidebar/machine-status-dot"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/client"
import { requireRouteScope } from "@/lib/auth/route-guards"
import { SCOPES, useHasScope } from "@/lib/auth/scopes"
import { formatCount, formatDuration, formatTimestamp } from "@/lib/format"
import {
  collectorMachineHealth,
  tickSummary,
  useCacheStatsQuery,
  useCachedServersQuery,
  useCollectorStatusQuery,
  useFlushCacheMutation,
  useForceTickMutation,
} from "@/lib/queries/admin"
import { machineName, machinesQueryOptions } from "@/lib/queries/machines"
import {
  readLatestTs,
  readSampleCount,
  useMetricCountsQuery,
  usePurgeAllMetricsMutation,
} from "@/lib/queries/metrics"
import { useQuery } from "@tanstack/react-query"
import { Navigate, createFileRoute } from "@tanstack/react-router"
import { RefreshCw, Trash2 } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/_authed/admin")({
  beforeLoad: ({ context, location }) =>
    requireRouteScope(context.queryClient, SCOPES.adminRead, location.href),
  component: AdminPage,
})

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

function AdminPage() {
  // Reading the collector and the cache is `admin:read`; making either of them
  // do something is `admin:write`; the sample counts and the purge are the
  // metrics scopes, which an admin does not automatically hold.
  const canRead = useHasScope(SCOPES.adminRead)
  const canWrite = useHasScope(SCOPES.adminWrite)
  const canReadMachines = useHasScope(SCOPES.machinesRead)
  const canReadMetrics = useHasScope(SCOPES.metricsRead)
  const canPurge = useHasScope(SCOPES.metricsWrite)

  const { data: collector } = useCollectorStatusQuery()
  const { data: cache } = useCacheStatsQuery()
  const { data: servers } = useCachedServersQuery()
  const { data: counts } = useMetricCountsQuery()
  const { data: machines } = useQuery({
    ...machinesQueryOptions(),
    enabled: canReadMachines,
  })

  const tick = useForceTickMutation()
  const flush = useFlushCacheMutation()
  const purgeAll = usePurgeAllMetricsMutation()
  const [confirmingPurge, setConfirmingPurge] = React.useState(false)
  const [cutoff, setCutoff] = React.useState<Date | undefined>(undefined)
  const before = cutoff?.toISOString()

  const health = Object.values(collectorMachineHealth(collector))
  const ticks = collector?.tick_count ?? collector?.ticks
  // What the last round did, which is the first thing worth knowing when
  // every machine reads zero samples.
  const lastRound =
    typeof collector?.last_inserted === "number" ||
    typeof collector?.last_failed === "number"
      ? `${collector.last_inserted ?? 0} stored / ${collector.last_failed ?? 0} failed`
      : null

  const labelFor = (mac: string) => {
    const machine = machines?.find((entry) => entry.mac === mac)
    return machine ? machineName(machine) : mac
  }

  if (!canRead) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Admin</h1>

      <Card>
        <CardHeader>
          <CardTitle>Collector</CardTitle>
          <CardDescription>
            Loop health and per-machine poll counters.
          </CardDescription>
          {canWrite ? (
            <CardAction>
              <Button
                variant="outline"
                disabled={tick.isPending}
                onClick={() =>
                  tick.mutate(undefined, {
                    onSuccess: (result) => {
                      const { stored, failed } = tickSummary(result)
                      toast.success(
                        stored === null && failed === null
                          ? "Collection round finished"
                          : `Round finished: ${stored ?? 0} stored, ${failed ?? 0} failed`
                      )
                    },
                    onError: (error) =>
                      toast.error(errorMessage(error, "Force tick failed")),
                  })
                }
              >
                {tick.isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <RefreshCw data-icon="inline-start" />
                )}
                Force tick
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {/* Counters and durations only. "Last tick N ago" and a countdown to
              the next round were both this browser's clock minus the
              collector's, which on a fleet without reliable NTP measured the
              disagreement rather than the loop. */}
          <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <Fact
              label="State"
              value={collector?.running === false ? "stopped" : "running"}
            />
            <Fact
              label="Interval"
              value={
                typeof collector?.interval_seconds === "number"
                  ? formatDuration(collector.interval_seconds)
                  : "n/a"
              }
            />
            <Fact
              label="Rounds"
              value={typeof ticks === "number" ? formatCount(ticks) : "n/a"}
            />
            <Fact label="Last round" value={lastRound ?? "n/a"} />
          </dl>
          {(collector?.last_tick_error ?? collector?.last_error) ? (
            <p className="text-sm text-destructive">
              {collector.last_tick_error ?? collector.last_error}
            </p>
          ) : null}
          {health.length > 0 ? (
            <div className="flex flex-col">
              {health.map((entry, index) => (
                <div key={entry.mac}>
                  {index > 0 ? <Separator /> : null}
                  <div className="flex items-center gap-3 px-1 py-2 text-sm">
                    <MachineStatusDot
                      health={entry.failing ? "failing" : "reporting"}
                    />
                    <span className="flex-1 truncate">
                      {labelFor(entry.mac)}
                    </span>
                    {/* Shown whenever the collector still remembers it: an
                        error that has since been superseded by a good poll is
                        history, so the dot above is what says "now". */}
                    {entry.lastError ? (
                      <span className="truncate text-xs text-destructive">
                        {entry.lastError}
                        {entry.lastErrorAt
                          ? ` · ${formatTimestamp(entry.lastErrorAt)}`
                          : null}
                      </span>
                    ) : null}
                    <Badge variant="secondary">{entry.okCount ?? 0} ok</Badge>
                    <Badge
                      variant={entry.failing ? "destructive" : "secondary"}
                    >
                      {entry.failCount ?? 0} failed
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>OpenStack cache</CardTitle>
          <CardDescription>
            The fleet as the lookup currently sees it. These are the addresses
            that can be registered.
          </CardDescription>
          {canWrite ? (
            <CardAction>
              <Button
                variant="outline"
                disabled={flush.isPending}
                onClick={() =>
                  flush.mutate(undefined, {
                    onSuccess: (result) =>
                      toast.success(
                        `Dropped ${result.dropped_servers} cached servers`
                      ),
                    onError: (error) =>
                      toast.error(errorMessage(error, "Cache flush failed")),
                  })
                }
              >
                {flush.isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Trash2 data-icon="inline-start" />
                )}
                Flush cache
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <Fact label="Populated" value={cache?.populated ? "yes" : "no"} />
            <Fact label="Servers" value={String(cache?.servers ?? 0)} />
            <Fact
              label="Age"
              value={
                typeof cache?.age_seconds === "number"
                  ? `${formatDuration(cache.age_seconds)} / ${formatDuration(cache.ttl_seconds)}`
                  : "n/a"
              }
            />
            <Fact
              label="Hits / misses"
              value={`${cache?.hits ?? 0} / ${cache?.misses ?? 0}`}
            />
          </dl>
          {cache?.last_error ? (
            <p className="text-sm text-destructive">{cache.last_error}</p>
          ) : null}
          <div className="flex flex-col">
            {(servers ?? []).map((server, index) => (
              <div key={server.server_id}>
                {index > 0 ? <Separator /> : null}
                <div className="flex items-center gap-3 px-1 py-2 text-sm">
                  <span className="flex-1 truncate font-medium">
                    {server.name}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {server.ipv4} ·{" "}
                    <span className="font-mono">{server.mac}</span>
                  </span>
                  <Badge variant="outline">{server.flavor.name}</Badge>
                  <Badge variant="secondary">{server.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <CredentialsAdminCard />

      {canReadMetrics ? (
        <Card>
          <CardHeader>
            <CardTitle>Stored samples</CardTitle>
            <CardDescription>
              Row count and newest sample per machine.
            </CardDescription>
            {canPurge ? (
              <CardAction>
                <Button
                  variant="destructive"
                  onClick={() => setConfirmingPurge(true)}
                >
                  <Trash2 data-icon="inline-start" />
                  Purge samples
                </Button>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-col">
            {(counts ?? []).map((count, index) => {
              const samples = readSampleCount(count)
              const latest = readLatestTs(count)
              return (
                <div key={count.mac}>
                  {index > 0 ? <Separator /> : null}
                  <div className="flex items-center gap-3 px-1 py-2 text-sm">
                    <span className="flex-1 truncate">
                      {labelFor(count.mac)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {latest ? formatTimestamp(latest) : "no samples"}
                    </span>
                    <span className="font-medium tabular-nums">
                      {samples === null ? "n/a" : formatCount(samples)}
                    </span>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      ) : null}

      <Dialog
        open={confirmingPurge}
        onOpenChange={(next) => {
          setConfirmingPurge(next)
          if (!next) setCutoff(undefined)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {before
                ? "Purge samples older than this?"
                : "Purge every machine's history?"}
            </DialogTitle>
            <DialogDescription>
              {before
                ? "Registrations and newer samples survive. This cannot be undone."
                : "This truncates the metrics hypertable. Registrations survive; every stored sample does not. This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <PurgeCutoffField
            id="purge-all-cutoff"
            value={cutoff}
            onChange={setCutoff}
            disabled={purgeAll.isPending}
            // The fleet-wide purge drops whole chunks rather than rows, so the
            // cutoff is honoured chunk-granularly and a chunk straddling it
            // survives intact.
            description="Whole chunks older than this are dropped, so some slightly newer samples can survive."
          />
          <DialogFooter className="mt-2">
            <Button
              variant="ghost"
              disabled={purgeAll.isPending}
              onClick={() => setConfirmingPurge(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={purgeAll.isPending}
              onClick={() =>
                purgeAll.mutate(
                  { before },
                  {
                    onSuccess: (result) =>
                      toast.success(
                        result.rows_deleted == null
                          ? `History purged (${result.method})`
                          : `Purged ${formatCount(result.rows_deleted)} samples`
                      ),
                    onError: (error) =>
                      toast.error(errorMessage(error, "Purge failed")),
                    onSettled: () => setConfirmingPurge(false),
                  }
                )
              }
            >
              {purgeAll.isPending ? <Spinner data-icon="inline-start" /> : null}
              {before ? "Purge older samples" : "Purge everything"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  )
}
