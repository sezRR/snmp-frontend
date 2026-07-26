import type { Machine, ServerInfo } from "@/lib/api/types"

// Machines are grouped by the OpenStack facts, since that is where tenant,
// owner and flavor actually live. A machine OpenStack no longer knows about
// still has to land somewhere, so it groups under "unknown".

export const ALL = "__all__"
export const UNKNOWN = "unknown"

export type FacetKey = "tenant" | "user" | "flavor"

export type MachineFilter = Record<FacetKey, string>

export const EMPTY_FILTER: MachineFilter = {
  tenant: ALL,
  user: ALL,
  flavor: ALL,
}

export const FACET_LABELS: Record<FacetKey, string> = {
  tenant: "Tenant",
  user: "User",
  flavor: "Flavor",
}

export function serverFacet(server: ServerInfo, facet: FacetKey): string {
  if (facet === "tenant") return server.tenant_name
  if (facet === "user") return server.user_name
  return server.flavor.name
}

export function machineFacet(machine: Machine, facet: FacetKey): string {
  return machine.openstack ? serverFacet(machine.openstack, facet) : UNKNOWN
}

export function isFiltered(filter: MachineFilter): boolean {
  return Object.values(filter).some((value) => value !== ALL)
}

export function filterMachines(
  machines: Machine[],
  filter: MachineFilter
): Machine[] {
  return machines.filter((machine) =>
    (Object.keys(FACET_LABELS) as FacetKey[]).every(
      (facet) =>
        filter[facet] === ALL || machineFacet(machine, facet) === filter[facet]
    )
  )
}

export interface FacetCount {
  value: string
  /** Machines registered here in this group. */
  registered: number
  /** Servers OpenStack reports in this group, registered or not. */
  total: number
}

/**
 * Counts per facet value across the whole OpenStack fleet, annotated with how
 * many of them are registered for polling — the gap is what is not monitored.
 */
export function facetCounts(
  machines: Machine[],
  servers: ServerInfo[],
  facet: FacetKey
): FacetCount[] {
  const totals = new Map<string, number>()
  for (const server of servers) {
    const value = serverFacet(server, facet)
    totals.set(value, (totals.get(value) ?? 0) + 1)
  }

  const registered = new Map<string, number>()
  for (const machine of machines) {
    const value = machineFacet(machine, facet)
    registered.set(value, (registered.get(value) ?? 0) + 1)
    if (!totals.has(value)) totals.set(value, 0)
  }

  return [...totals.entries()]
    .map(([value, total]) => ({
      value,
      total,
      registered: registered.get(value) ?? 0,
    }))
    .sort((a, b) => b.total - a.total || a.value.localeCompare(b.value))
}
