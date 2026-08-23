import type { Machine, MetricSample } from "@/lib/api/types"
import { machineFacet } from "@/lib/machine-facets"
import { normalizeSample } from "@/lib/metrics"
import { machineName } from "@/lib/queries/machines"

export type SortKey =
  | "name"
  | "cpu"
  | "ram"
  | "ram_used"
  | "disk"
  | "net"
  | "sampled"
  | "tenant"
  | "user"
  | "flavor"

export type SortDirection = "asc" | "desc"

export const SORT_LABELS: Record<SortKey, string> = {
  name: "Name",
  cpu: "CPU usage",
  ram: "RAM usage %",
  ram_used: "RAM used",
  disk: "Disk usage",
  net: "Bandwidth",
  sampled: "Last sample",
  tenant: "Tenant",
  user: "User",
  flavor: "Flavor",
}

export const sortKeys = Object.keys(SORT_LABELS) as SortKey[]

export const DEFAULT_SORT: SortKey = "name"

const TEXT_KEYS: SortKey[] = ["name", "tenant", "user", "flavor"]

export function defaultDirection(key: SortKey): SortDirection {
  return TEXT_KEYS.includes(key) ? "asc" : "desc"
}

function numericValue(
  machine: Machine,
  sample: MetricSample | undefined,
  key: SortKey
): number | null {
  if (key === "sampled") return sample ? Date.parse(sample.ts) : null
  if (!sample) return null
  const snapshot = normalizeSample(sample, machine)
  switch (key) {
    case "cpu":
      return snapshot.cpuPercent
    case "ram":
      return snapshot.ram.usedPercent
    case "ram_used":
      return snapshot.ram.usedBytes
    case "disk":
      return snapshot.primaryDisk?.usedPercent ?? null
    case "net":
      return (snapshot.net.rxBps ?? 0) + (snapshot.net.txBps ?? 0)
    default:
      return null
  }
}

function textValue(machine: Machine, key: SortKey): string {
  if (key === "name") return machineName(machine).toLocaleLowerCase()
  if (key === "tenant") return machineFacet(machine, "tenant")
  if (key === "user") return machineFacet(machine, "user")
  return machineFacet(machine, "flavor")
}

export function sortMachines(
  machines: Machine[],
  key: SortKey,
  direction: SortDirection,
  samples: Record<string, MetricSample>
): Machine[] {
  const sign = direction === "asc" ? 1 : -1
  const isText = TEXT_KEYS.includes(key)

  return [...machines].sort((a, b) => {
    if (isText) {
      const compared = textValue(a, key).localeCompare(textValue(b, key))
      if (compared !== 0) return compared * sign
    } else {
      const left = numericValue(a, samples[a.mac], key)
      const right = numericValue(b, samples[b.mac], key)
      if (left === null && right !== null) return 1
      if (right === null && left !== null) return -1
      if (left !== null && right !== null && left !== right) {
        return (left - right) * sign
      }
    }
    return machineName(a).localeCompare(machineName(b))
  })
}
