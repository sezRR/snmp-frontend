import type { Machine, ServerInfo } from "@/lib/api/types"

export const ALL = "__all__"
export const UNKNOWN = "unknown"

export type FacetKey = "tenant" | "user" | "subnet" | "flavor"

export type MachineFilter = Record<FacetKey, string>

export const EMPTY_FILTER: MachineFilter = {
  tenant: ALL,
  user: ALL,
  subnet: ALL,
  flavor: ALL,
}

export const FACET_LABELS: Record<FacetKey, string> = {
  tenant: "Tenant",
  user: "User",
  subnet: "Subnet",
  flavor: "Flavor",
}

export function serverFacet(server: ServerInfo, facet: FacetKey): string {
  if (facet === "tenant") return server.tenant_name
  if (facet === "user") return server.user_name
  if (facet === "subnet") return server.subnet_name ?? UNKNOWN
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
  filter: MachineFilter,
  query = ""
): Machine[] {
  const normalizedQuery = query.trim().toLowerCase()

  return machines.filter((machine) => {
    const matchesFacets = (Object.keys(FACET_LABELS) as FacetKey[]).every(
      (facet) =>
        filter[facet] === ALL || machineFacet(machine, facet) === filter[facet]
    )
    if (!matchesFacets || normalizedQuery === "") return matchesFacets

    return [
      machine.label,
      machine.openstack?.name,
      machine.ipv4,
      machine.mac,
      machine.mac.replaceAll(":", "-"),
    ].some((value) => value?.toLowerCase().includes(normalizedQuery))
  })
}

export interface FacetCount {
  value: string
  registered: number
  total: number
}

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
