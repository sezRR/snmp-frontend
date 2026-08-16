import { API_BASE_URL, api } from "@/lib/api/client"
import { machinesQueryKey } from "@/lib/queries/machines"
import { metricsQueryKey } from "@/lib/queries/metrics"
import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { z } from "zod"

// Only the dev mock implements /__dev/faults. Production never serves it, and
// this module is behind an import.meta.env.DEV check at the one place it is
// rendered, so it drops out of a production build.

export const faultSchema = z.enum([
  "none",
  "host_down",
  "snmpd_inactive",
  "collection_failed",
  "openstack_deleted",
])
export type Fault = z.infer<typeof faultSchema>

export const FAULT_LABELS: Record<Fault, string> = {
  none: "Healthy",
  host_down: "Host down",
  snmpd_inactive: "snmpd inactive",
  collection_failed: "Collection failed",
  openstack_deleted: "Deleted in OpenStack",
}

export const FAULT_DESCRIPTIONS: Record<Fault, string> = {
  none: "Polls succeed and samples keep arriving.",
  host_down: "Poll times out. No new samples, collector failures climb.",
  snmpd_inactive: "udp/161 refused. The host is up but the agent is not.",
  collection_failed: "The walk errors out on a missing OID.",
  openstack_deleted:
    "The MAC vanishes from OpenStack: openstack_found goes false and the flavor limits disappear.",
}

const faultsResponseSchema = z.object({
  available: z.array(faultSchema),
  faults: z.record(z.string(), faultSchema),
})

/** The dev endpoints exist only when the Vite mock is answering. */
export const devApiAvailable = import.meta.env.DEV && API_BASE_URL === ""

export const devFaultsQueryOptions = () =>
  queryOptions({
    queryKey: ["dev", "faults"] as const,
    queryFn: () => api.get("/__dev/faults", { schema: faultsResponseSchema }),
    enabled: devApiAvailable,
    staleTime: 5_000,
  })

/** A fault changes machines, metrics and collector health all at once. */
function useInvalidateEverything() {
  const queryClient = useQueryClient()
  return () => {
    for (const queryKey of [
      ["dev", "faults"],
      machinesQueryKey,
      metricsQueryKey,
      ["admin"],
    ]) {
      void queryClient.invalidateQueries({ queryKey })
    }
  }
}

export function useSetFaultMutation() {
  const invalidate = useInvalidateEverything()
  return useMutation({
    mutationFn: ({ mac, fault }: { mac: string; fault: Fault }) =>
      api.post<{ mac: string; fault: Fault }>("/__dev/faults", {
        body: { mac, fault },
      }),
    onSuccess: invalidate,
  })
}

export function useClearFaultsMutation() {
  const invalidate = useInvalidateEverything()
  return useMutation({
    mutationFn: () => api.delete<{ cleared: number }>("/__dev/faults"),
    onSuccess: invalidate,
  })
}
