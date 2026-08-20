import { AddMachineDialog } from "@/components/machines/add-machine-dialog"
import { DeregisterMachinesDialog } from "@/components/machines/deregister-machines-dialog"
import { FleetSummary } from "@/components/machines/fleet-summary"
import { MachineGrid } from "@/components/machines/machine-grid"
import { MachineToolbar } from "@/components/machines/machine-toolbar"
import { Card, CardAction, CardContent, CardHeader } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { useMachineSamples } from "@/hooks/use-machine-samples"
import {
  EMPTY_FILTER,
  type MachineFilter,
  filterMachines,
  isFiltered,
} from "@/lib/machine-facets"
import {
  DEFAULT_SORT,
  type SortDirection,
  type SortKey,
  defaultDirection,
  sortMachines,
} from "@/lib/machine-sort"
import { useCachedServersQuery } from "@/lib/queries/admin"
import { machinesQueryOptions } from "@/lib/queries/machines"
import { latestMetricsQueryOptions } from "@/lib/queries/metrics"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Server } from "lucide-react"
import * as React from "react"

export const Route = createFileRoute("/_authenticated/")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(machinesQueryOptions()),
      context.queryClient.ensureQueryData(latestMetricsQueryOptions()),
    ]),
  pendingComponent: DashboardSkeleton,
  component: DashboardPage,
})

function DashboardPage() {
  const { data: machines } = useSuspenseQuery(machinesQueryOptions())
  const { data: servers } = useCachedServersQuery()
  const samples = useMachineSamples()

  const [filter, setFilter] = React.useState<MachineFilter>(EMPTY_FILTER)
  const [search, setSearch] = React.useState("")
  const deferredSearch = React.useDeferredValue(search)
  const [sort, setSort] = React.useState<SortKey>(DEFAULT_SORT)
  const [direction, setDirection] = React.useState<SortDirection>(
    defaultDirection(DEFAULT_SORT)
  )

  if (machines.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Server />
          </EmptyMedia>
          <EmptyTitle>No machines registered</EmptyTitle>
          <EmptyDescription>
            Register an address OpenStack knows about to start polling it over
            SNMP.
          </EmptyDescription>
        </EmptyHeader>
        <AddMachineDialog />
      </Empty>
    )
  }

  const visible = sortMachines(
    filterMachines(machines, filter, deferredSearch),
    sort,
    direction,
    samples
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <DeregisterMachinesDialog machines={machines} />
          <AddMachineDialog />
        </div>
      </div>
      <FleetSummary machines={machines} servers={servers} />
      <MachineToolbar
        machines={machines}
        servers={servers ?? []}
        filter={filter}
        onFilterChange={setFilter}
        search={{ value: search, onChange: setSearch }}
        sort={sort}
        direction={direction}
        onSortChange={(nextSort, nextDirection) => {
          setSort(nextSort)
          setDirection(nextDirection)
        }}
        matched={visible.length}
      />
      {visible.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Server />
            </EmptyMedia>
            <EmptyTitle>
              {deferredSearch.trim()
                ? "No machines match your search"
                : "No machines match these filters"}
            </EmptyTitle>
            <EmptyDescription>
              {deferredSearch.trim()
                ? `Try another name, IP address, or MAC address${
                    isFiltered(filter) ? ", or clear the filters" : ""
                  }.`
                : "Clear the tenant, user, subnet or flavor filter to see the rest of the fleet."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <MachineGrid machines={visible} />
      )}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div
      className="flex flex-col gap-4"
      aria-label="Loading dashboard"
      aria-busy="true"
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-28" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <DashboardStatSkeleton key={index} />
        ))}
      </div>
      <DashboardToolbarSkeleton />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <MachineCardSkeleton key={index} />
        ))}
      </div>
    </div>
  )
}

function DashboardStatSkeleton() {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="flex flex-col gap-0.5">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-4 w-28 max-w-full" />
      </CardContent>
    </Card>
  )
}

function DashboardToolbarSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 w-full sm:w-64" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-28" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-8 w-36" />
          <Skeleton className="size-8" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-44" />
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-[22px] w-36" />
          <Skeleton className="h-5 w-72 max-w-full" />
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-1">
              <Skeleton className="h-4 w-20" />
              {Array.from({ length: 3 }).map((__, rowIndex) => (
                <Skeleton key={rowIndex} className="h-7 w-full" />
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function MachineCardSkeleton() {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Skeleton className="size-2" />
          <Skeleton className="h-[22px] w-40" />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-20" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
        <CardAction>
          <Skeleton className="size-7" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-0.5">
              <Skeleton className="h-4 w-16" />
              {index < 3 ? (
                <>
                  <Skeleton className="h-5 w-20 max-w-full" />
                  <Skeleton className="h-4 w-24 max-w-full" />
                </>
              ) : (
                <Skeleton className="h-10 w-24 max-w-full" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
