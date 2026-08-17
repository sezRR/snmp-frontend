import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Machine, ServerInfo } from "@/lib/api/types"
import {
  ALL,
  FACET_LABELS,
  type FacetKey,
  type MachineFilter,
  facetCounts,
} from "@/lib/machine-facets"
import { cn } from "@/lib/utils"

interface FleetBreakdownProps {
  machines: Machine[]
  servers: ServerInfo[]
  filter: MachineFilter
  onFilterChange: (filter: MachineFilter) => void
}

const facets = Object.keys(FACET_LABELS) as FacetKey[]

/**
 * How the OpenStack fleet splits by tenant, owner, subnet and flavor, with the
 * registered-here count against each group's total. Rows double as filters.
 */
export function FleetBreakdown({
  machines,
  servers,
  filter,
  onFilterChange,
}: FleetBreakdownProps) {
  const registeredMacs = new Set(machines.map((machine) => machine.mac))
  const unregistered = servers.filter(
    (server) => !registeredMacs.has(server.mac)
  ).length

  return (
    <Card>
      <CardHeader>
        <CardTitle>OpenStack fleet</CardTitle>
        <CardDescription>
          {servers.length} server{servers.length === 1 ? "" : "s"} known to
          OpenStack · {machines.length} registered here
          {unregistered > 0 ? ` · ${unregistered} not monitored` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {facets.map((facet) => (
          <div key={facet} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {FACET_LABELS[facet]}
            </span>
            {facetCounts(machines, servers, facet).map((count) => {
              const active = filter[facet] === count.value
              return (
                <button
                  key={count.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    onFilterChange({
                      ...filter,
                      [facet]: active ? ALL : count.value,
                    })
                  }
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                    active && "bg-muted font-medium"
                  )}
                >
                  <span className="truncate">{count.value}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {count.registered} / {count.total}
                  </span>
                </button>
              )
            })}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
