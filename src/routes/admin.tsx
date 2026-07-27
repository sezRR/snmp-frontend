import { NextTickCountdown } from "@/components/collector-countdown"
import { PurgeCutoffField } from "@/components/metrics/purge-cutoff-field"
import { RelativeTime } from "@/components/relative-time"
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
import { useLastTickAt } from "@/hooks/use-live-sync"
import { ApiError } from "@/lib/api/client"
import { formatCount, formatDuration } from "@/lib/format"
import {
  cacheStatsQueryOptions,
  cachedServersQueryOptions,
  collectorMachineHealth,
  collectorStatusQueryOptions,
  useFlushCacheMutation,
  useForceTickMutation,
} from "@/lib/queries/admin"
import { machineName, machinesQueryOptions } from "@/lib/queries/machines"
import {
  metricCountsQueryOptions,
  readLatestTs,
  readSampleCount,
  usePurgeAllMetricsMutation,
} from "@/lib/queries/metrics"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { RefreshCw, Trash2 } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/admin")({
  component: AdminPage,
})

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

function AdminPage() {
  const { data: collector } = useQuery(collectorStatusQueryOptions())
  const { data: cache } = useQuery(cacheStatsQueryOptions())
  const { data: servers } = useQuery(cachedServersQueryOptions())
  const { data: counts } = useQuery(metricCountsQueryOptions())
  const { data: machines } = useQuery(machinesQueryOptions())
  const lastTickAt = useLastTickAt(collector)

  const tick = useForceTickMutation()
  const flush = useFlushCacheMutation()
  const purgeAll = usePurgeAllMetricsMutation()
  const [confirmingPurge, setConfirmingPurge] = React.useState(false)
  const [cutoff, setCutoff] = React.useState<Date | undefined>(undefined)
  const before = cutoff?.toISOString()

  const health = Object.values(collectorMachineHealth(collector))
  const labelFor = (mac: string) => {
    const machine = machines?.find((entry) => entry.mac === mac)
    return machine ? machineName(machine) : mac
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
          <CardAction>
            <Button
              variant="outline"
              disabled={tick.isPending}
              onClick={() =>
                tick.mutate(undefined, {
                  onSuccess: () => toast.success("Collection round finished"),
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
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
            <Fact
              label="State"
              value={collector?.running === false ? "stopped" : "running"}
            />
            <Fact
              label="Interval"
              value={
                typeof collector?.interval_seconds === "number"
                  ? formatDuration(collector.interval_seconds)
                  : "—"
              }
            />
            <Fact
              label="Last tick"
              value={lastTickAt ? <RelativeTime iso={lastTickAt} /> : "—"}
            />
            <Fact
              label="Next tick"
              value={
                lastTickAt &&
                typeof collector?.interval_seconds === "number" ? (
                  <NextTickCountdown
                    lastTickAt={lastTickAt}
                    intervalSeconds={collector.interval_seconds}
                  />
                ) : (
                  "—"
                )
              }
            />
            <Fact
              label="Ticks"
              value={
                typeof collector?.ticks === "number"
                  ? formatCount(collector.ticks)
                  : "—"
              }
            />
          </dl>
          {health.length > 0 ? (
            <div className="flex flex-col">
              {health.map((entry, index) => (
                <div key={entry.mac}>
                  {index > 0 ? <Separator /> : null}
                  <div className="flex items-center gap-3 px-1 py-2 text-sm">
                    <span className="flex-1 truncate">
                      {labelFor(entry.mac)}
                    </span>
                    {entry.lastError ? (
                      <span className="truncate text-xs text-destructive">
                        {entry.lastError}
                      </span>
                    ) : null}
                    <Badge variant="secondary">{entry.success ?? 0} ok</Badge>
                    <Badge
                      variant={
                        (entry.failure ?? 0) > 0 ? "destructive" : "secondary"
                      }
                    >
                      {entry.failure ?? 0} failed
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
            The fleet as the lookup currently sees it — these are the addresses
            that can be registered.
          </CardDescription>
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
                  : "—"
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

      <Card>
        <CardHeader>
          <CardTitle>Stored samples</CardTitle>
          <CardDescription>
            Row count and newest sample per machine.
          </CardDescription>
          <CardAction>
            <Button
              variant="destructive"
              onClick={() => setConfirmingPurge(true)}
            >
              <Trash2 data-icon="inline-start" />
              Purge samples
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col">
          {(counts ?? []).map((count, index) => {
            const samples = readSampleCount(count)
            const latest = readLatestTs(count)
            return (
              <div key={count.mac}>
                {index > 0 ? <Separator /> : null}
                <div className="flex items-center gap-3 px-1 py-2 text-sm">
                  <span className="flex-1 truncate">{labelFor(count.mac)}</span>
                  <span className="text-xs text-muted-foreground">
                    {latest ? <RelativeTime iso={latest} /> : "no samples"}
                  </span>
                  <span className="font-medium tabular-nums">
                    {samples === null ? "—" : formatCount(samples)}
                  </span>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

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
