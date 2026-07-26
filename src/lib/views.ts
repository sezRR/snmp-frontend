import { createLocalStore, useLocalStore } from "@/lib/local-store"
import { z } from "zod"

// A view is a named subset of the fleet. It is the client's own scratch state:
// the backend has no concept of it, so views live in localStorage and are
// disposable by design.

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

export function deleteView(id: string): void {
  viewsStore.set((previous) => previous.filter((view) => view.id !== id))
}

/** Drops machines that no longer exist, so a deleted machine can't ghost a view. */
export function pruneViews(knownMacs: string[]): void {
  const known = new Set(knownMacs)
  viewsStore.set((previous) =>
    previous.map((view) => ({
      ...view,
      macs: view.macs.filter((mac) => known.has(mac)),
    }))
  )
}
