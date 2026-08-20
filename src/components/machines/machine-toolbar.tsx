import { FleetBreakdown } from "@/components/machines/fleet-breakdown"
import { MachineFilters } from "@/components/machines/machine-filters"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Machine, ServerInfo } from "@/lib/api/types"
import { createLocalStore, useLocalStore } from "@/lib/local-store"
import { ALL, type MachineFilter } from "@/lib/machine-facets"
import {
  SORT_LABELS,
  type SortDirection,
  type SortKey,
  defaultDirection,
  sortKeys,
} from "@/lib/machine-sort"
import { cn } from "@/lib/utils"
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ChevronDown,
  SlidersHorizontal,
} from "lucide-react"
import { z } from "zod"

// Collapsed by default would hide the fleet breakdown that makes the dashboard
// useful, so the panel starts open and remembers whatever the user chose.
const panelOpenStore = createLocalStore<boolean>(
  "snmp.filters-open",
  true,
  z.boolean()
)

interface MachineToolbarProps {
  /** Every machine in scope — the whole fleet, or a view's members. */
  machines: Machine[]
  /** OpenStack servers in the same scope, for the group totals. */
  servers: ServerInfo[]
  filter: MachineFilter
  onFilterChange: (filter: MachineFilter) => void
  sort: SortKey
  direction: SortDirection
  onSortChange: (sort: SortKey, direction: SortDirection) => void
  matched: number
  showBreakdown?: boolean
  search?: {
    value: string
    onChange: (value: string) => void
  }
}

export function MachineToolbar({
  machines,
  servers,
  filter,
  onFilterChange,
  sort,
  direction,
  onSortChange,
  matched,
  showBreakdown = true,
  search,
}: MachineToolbarProps) {
  const open = useLocalStore(panelOpenStore)
  const activeFilters = Object.values(filter).filter(
    (value) => value !== ALL
  ).length

  const sortItems = Object.fromEntries(
    sortKeys.map((key) => [key, SORT_LABELS[key]])
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {search ? (
          <Field className="w-full sm:w-64">
            <FieldLabel htmlFor="machine-search" className="sr-only">
              Search machines
            </FieldLabel>
            <Input
              id="machine-search"
              type="search"
              placeholder="Search name, IP, or MAC..."
              value={search.value}
              onChange={(event) => search.onChange(event.target.value)}
            />
          </Field>
        ) : null}
        <Button
          variant="outline"
          aria-expanded={open}
          onClick={() => panelOpenStore.set(!open)}
        >
          <SlidersHorizontal data-icon="inline-start" />
          Filters
          {activeFilters > 0 ? (
            <Badge variant="secondary">{activeFilters}</Badge>
          ) : null}
          <ChevronDown
            data-icon="inline-end"
            className={cn("transition-transform", open && "rotate-180")}
          />
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums">
          {matched} of {machines.length} machines
        </span>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Sort by</span>
          <Select
            items={sortItems}
            value={sort}
            onValueChange={(next) =>
              onSortChange(next as SortKey, defaultDirection(next as SortKey))
            }
          >
            <SelectTrigger className="min-w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {sortKeys.map((key) => (
                  <SelectItem key={key} value={key}>
                    {SORT_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            aria-label={
              direction === "asc" ? "Sort ascending" : "Sort descending"
            }
            onClick={() =>
              onSortChange(sort, direction === "asc" ? "desc" : "asc")
            }
          >
            {direction === "asc" ? (
              <ArrowUpNarrowWide />
            ) : (
              <ArrowDownWideNarrow />
            )}
          </Button>
        </div>
      </div>

      {open ? (
        <div className="flex flex-col gap-3">
          <MachineFilters
            machines={machines}
            servers={servers}
            value={filter}
            onChange={onFilterChange}
          />
          {showBreakdown ? (
            <FleetBreakdown
              machines={machines}
              servers={servers}
              filter={filter}
              onFilterChange={onFilterChange}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
