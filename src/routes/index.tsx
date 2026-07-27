import { AddMachineDialog } from "@/components/machines/add-machine-dialog"
import { DeregisterMachinesDialog } from "@/components/machines/deregister-machines-dialog"
import { FleetSummary } from "@/components/machines/fleet-summary"
import { MachineGrid } from "@/components/machines/machine-grid"
import { MachineToolbar } from "@/components/machines/machine-toolbar"
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
} from "@/lib/machine-facets"
import {
  DEFAULT_SORT,
  type SortDirection,
  type SortKey,
  defaultDirection,
  sortMachines,
} from "@/lib/machine-sort"
import { cachedServersQueryOptions } from "@/lib/queries/admin"
import { machinesQueryOptions } from "@/lib/queries/machines"
import { latestMetricsQueryOptions } from "@/lib/queries/metrics"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Server } from "lucide-react"
import * as React from "react"

export const Route = createFileRoute("/")({
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
  const { data: servers } = useQuery(cachedServersQueryOptions())
  const samples = useMachineSamples()

  const [filter, setFilter] = React.useState<MachineFilter>(EMPTY_FILTER)
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
    filterMachines(machines, filter),
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
            <EmptyTitle>No machines match these filters</EmptyTitle>
            <EmptyDescription>
              Clear the tenant, user or flavor filter to see the rest of the
              fleet.
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
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-xl" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-44 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
