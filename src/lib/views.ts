import { createLocalStore, useLocalStore } from "@/lib/local-store"
import { z } from "zod"

export const viewSchema = z.object({
  id: z.string(),
  name: z.string(),
  macs: z.array(z.string()),
})
export type View = z.infer<typeof viewSchema>

const viewsStore = createLocalStore<View[]>(
  "snmp.views",
  [],
  z.array(viewSchema)
)

export function useViews(): View[] {
  return useLocalStore(viewsStore)
}

export function useView(id: string): View | undefined {
  return useViews().find((view) => view.id === id)
}

export function saveView(view: Omit<View, "id"> & { id?: string }): View {
  const saved: View = { ...view, id: view.id ?? crypto.randomUUID() }
  viewsStore.set((previous) => {
    const index = previous.findIndex((entry) => entry.id === saved.id)
    if (index === -1) return [...previous, saved]
    return previous.map((entry) => (entry.id === saved.id ? saved : entry))
  })
  return saved
}

export function addMachinesToView(id: string, macs: string[]): void {
  viewsStore.set((previous) =>
    previous.map((view) =>
      view.id === id
        ? { ...view, macs: [...new Set([...view.macs, ...macs])] }
        : view
    )
  )
}

export function removeMachinesFromView(id: string, macs: string[]): void {
  const dropped = new Set(macs)
  viewsStore.set((previous) =>
    previous.map((view) =>
      view.id === id
        ? { ...view, macs: view.macs.filter((mac) => !dropped.has(mac)) }
        : view
    )
  )
}

export function removeMachineFromViews(mac: string): void {
  viewsStore.set((previous) =>
    previous.map((view) =>
      view.macs.includes(mac)
        ? { ...view, macs: view.macs.filter((entry) => entry !== mac) }
        : view
    )
  )
}

export function deleteView(id: string): void {
  viewsStore.set((previous) => previous.filter((view) => view.id !== id))
}

export function pruneViews(knownMacs: string[]): void {
  const known = new Set(knownMacs)
  viewsStore.set((previous) =>
    previous.map((view) => ({
      ...view,
      macs: view.macs.filter((mac) => known.has(mac)),
    }))
  )
}
