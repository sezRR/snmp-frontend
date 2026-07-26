import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Machine, ServerInfo } from "@/lib/api/types"
import {
  ALL,
  EMPTY_FILTER,
  FACET_LABELS,
  type FacetKey,
  type MachineFilter,
  facetCounts,
  isFiltered,
} from "@/lib/machine-facets"
import { X } from "lucide-react"

interface MachineFiltersProps {
  machines: Machine[]
  servers: ServerInfo[]
  value: MachineFilter
  onChange: (filter: MachineFilter) => void
}

const facets = Object.keys(FACET_LABELS) as FacetKey[]

export function MachineFilters({
  machines,
  servers,
  value,
  onChange,
}: MachineFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {facets.map((facet) => {
        const counts = facetCounts(machines, servers, facet)
        const items: Record<string, string> = {
          [ALL]: `All ${FACET_LABELS[facet].toLowerCase()}s`,
          ...Object.fromEntries(
            counts.map((count) => [
              count.value,
              `${count.value} (${count.registered})`,
            ])
          ),
        }
        return (
          <Select
            key={facet}
            items={items}
            value={value[facet]}
            onValueChange={(next) =>
              onChange({ ...value, [facet]: next as string })
            }
          >
            <SelectTrigger className="min-w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={ALL}>
                  All {FACET_LABELS[facet].toLowerCase()}s
                </SelectItem>
                {counts.map((count) => (
                  <SelectItem key={count.value} value={count.value}>
                    {count.value} ({count.registered})
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )
      })}
      {isFiltered(value) ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange(EMPTY_FILTER)}
        >
          <X data-icon="inline-start" />
          Clear
        </Button>
      ) : null}
    </div>
  )
}
