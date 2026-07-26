import { createLocalStore, useLocalStore } from "@/lib/local-store"
import { z } from "zod"

const RECENT_LIMIT = 3

const recentSchema = z.array(z.string())

const recentMachinesStore = createLocalStore<string[]>(
  "snmp.recent-machines",
  [],
  recentSchema
)

export function rememberMachine(mac: string): void {
  recentMachinesStore.set((previous) =>
    [mac, ...previous.filter((entry) => entry !== mac)].slice(0, RECENT_LIMIT)
  )
}

export function forgetMachine(mac: string): void {
  recentMachinesStore.set((previous) =>
    previous.filter((entry) => entry !== mac)
  )
}

export function useRecentMachines(): string[] {
  return useLocalStore(recentMachinesStore)
}
