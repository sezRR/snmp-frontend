import { AddMachineDialog } from "@/components/machines/add-machine-dialog"
import { DeregisterMachinesDialog } from "@/components/machines/deregister-machines-dialog"
import { FleetSummary } from "@/components/machines/fleet-summary"
import { MachineGrid } from "@/components/machines/machine-grid"
import { MachineToolbar } from "@/components/machines/machine-toolbar"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { RemoveFromViewDialog } from "@/components/views/remove-from-view-dialog"
import { ViewDialog } from "@/components/views/view-dialog"
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
import { useCachedServersQuery } from "@/lib/queries/admin"
import { machinesQueryOptions } from "@/lib/queries/machines"
import { latestMetricsQueryOptions } from "@/lib/queries/metrics"
import { useView } from "@/lib/views"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { LayoutGrid, Pencil } from "lucide-react"
import * as React from "react"

export const Route = createFileRoute("/_authenticated/views/$viewId")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(machinesQueryOptions()),
      context.queryClient.ensureQueryData(latestMetricsQueryOptions()),
    ]),
  component: ViewPage,
})

function ViewPage() {
  const { viewId } = Route.useParams()
  const view = useView(viewId)
  const { data: machines } = useSuspenseQuery(machinesQueryOptions())
  const { data: servers } = useCachedServersQuery()
  const samples = useMachineSamples()

  const [editing, setEditing] = React.useState(false)
  const [filter, setFilter] = React.useState<MachineFilter>(EMPTY_FILTER)
  const [sort, setSort] = React.useState<SortKey>(DEFAULT_SORT)
  const [direction, setDirection] = React.useState<SortDirection>(
    defaultDirection(DEFAULT_SORT)
  )

  if (!view) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LayoutGrid />
          </EmptyMedia>
          <EmptyTitle>View not found</EmptyTitle>
          <EmptyDescription>
            Views live in this browser only, so a view saved elsewhere will not
            appear here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const members = machines.filter((machine) => view.macs.includes(machine.mac))
  const memberMacs = new Set(members.map((machine) => machine.mac))
  const memberServers = (servers ?? []).filter((entry) =>
    memberMacs.has(entry.mac)
  )
  const visible = sortMachines(
    filterMachines(members, filter),
    sort,
    direction,
    samples
  )

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold">{view.name}</h1>
          <span className="text-xs text-muted-foreground">
            {members.length} of {view.macs.length} saved machines still
            registered
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AddMachineDialog view={view} />
          {members.length > 0 ? (
            <>
              <RemoveFromViewDialog view={view} members={members} />
              <DeregisterMachinesDialog machines={members} />
            </>
          ) : null}
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil data-icon="inline-start" />
            Edit view
          </Button>
        </div>
      </div>
      {members.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LayoutGrid />
            </EmptyMedia>
            <EmptyTitle>Nothing in this view</EmptyTitle>
            <EmptyDescription>
              {view.macs.length > 0
                ? "Every machine it referenced has been deregistered."
                : "Add machines to fill it."}
            </EmptyDescription>
          </EmptyHeader>
          <AddMachineDialog view={view} />
        </Empty>
      ) : (
        <>
          <FleetSummary machines={members} />
          <MachineToolbar
            machines={members}
            servers={memberServers}
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
                  <LayoutGrid />
                </EmptyMedia>
                <EmptyTitle>No machines match these filters</EmptyTitle>
                <EmptyDescription>
                  Clear the tenant, user or flavor filter to see the whole view.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <MachineGrid machines={visible} />
          )}
        </>
      )}
      <ViewDialog open={editing} onOpenChange={setEditing} view={view} />
    </div>
  )
}
