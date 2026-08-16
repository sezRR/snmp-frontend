import { createLocalStore, useLocalStore } from "@/lib/local-store"
import { z } from "zod"

const sidebarSectionsSchema = z.object({
  machines: z.boolean(),
  views: z.boolean(),
})

export type SidebarSection = keyof z.infer<typeof sidebarSectionsSchema>

const sidebarSectionsStore = createLocalStore(
  "snmp.sidebar-sections",
  { machines: false, views: false },
  sidebarSectionsSchema
)

export function useSidebarSections() {
  return useLocalStore(sidebarSectionsStore)
}

export function setSidebarSection(
  section: SidebarSection,
  open: boolean
): void {
  sidebarSectionsStore.set((previous) => ({
    ...previous,
    [section]: open,
  }))
}
