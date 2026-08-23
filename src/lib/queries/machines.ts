import { api } from "@/lib/api/client"
import {
  type Machine,
  type MachineCreate,
  type MachineUpdate,
  machineSchema,
} from "@/lib/api/types"
import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { z } from "zod"

const machineListSchema = z.array(machineSchema)

export const machinesQueryKey = ["machines"] as const

export const machinesQueryOptions = (enabledOnly = false) =>
  queryOptions({
    queryKey: [...machinesQueryKey, { enabledOnly }] as const,
    queryFn: () =>
      api.get("/machines", {
        params: enabledOnly ? { enabled_only: true } : undefined,
        schema: machineListSchema,
      }),
    staleTime: 30_000,
  })

export const machineQueryOptions = (mac: string) =>
  queryOptions({
    queryKey: [...machinesQueryKey, mac] as const,
    queryFn: () =>
      api.get(`/machines/${encodeURIComponent(mac)}`, {
        schema: machineSchema,
      }),
    staleTime: 30_000,
  })

function useInvalidateMachines() {
  const queryClient = useQueryClient()
  return () =>
    void queryClient.invalidateQueries({ queryKey: machinesQueryKey })
}

export interface BulkRegisterResult {
  registered: Machine[]
  failed: { ipv4: string; reason: string }[]
}

export function useRegisterAllMachinesMutation() {
  const invalidate = useInvalidateMachines()
  return useMutation({
    mutationFn: async (
      bodies: MachineCreate[]
    ): Promise<BulkRegisterResult> => {
      const result: BulkRegisterResult = { registered: [], failed: [] }
      for (const body of bodies) {
        try {
          result.registered.push(
            await api.post("/machines", { body, schema: machineSchema })
          )
        } catch (error) {
          result.failed.push({
            ipv4: body.ipv4,
            reason: error instanceof Error ? error.message : "unknown error",
          })
        }
      }
      return result
    },
    onSuccess: invalidate,
  })
}

export interface BulkDeleteResult {
  removed: string[]
  failed: { mac: string; reason: string }[]
}

export function useDeleteMachinesMutation() {
  const invalidate = useInvalidateMachines()
  return useMutation({
    mutationFn: async (macs: string[]): Promise<BulkDeleteResult> => {
      const result: BulkDeleteResult = { removed: [], failed: [] }
      for (const mac of macs) {
        try {
          await api.delete<void>(`/machines/${encodeURIComponent(mac)}`)
          result.removed.push(mac)
        } catch (error) {
          result.failed.push({
            mac,
            reason: error instanceof Error ? error.message : "unknown error",
          })
        }
      }
      return result
    },
    onSuccess: invalidate,
  })
}

export function useUpdateMachineMutation() {
  const invalidate = useInvalidateMachines()
  return useMutation({
    mutationFn: ({ mac, ...body }: MachineUpdate & { mac: string }) =>
      api.patch(`/machines/${encodeURIComponent(mac)}`, {
        body,
        schema: machineSchema,
      }),
    onSuccess: invalidate,
  })
}

export function useDeleteMachineMutation() {
  const invalidate = useInvalidateMachines()
  return useMutation({
    mutationFn: (mac: string) =>
      api.delete<void>(`/machines/${encodeURIComponent(mac)}`),
    onSuccess: invalidate,
  })
}

export function machineName(machine: Machine): string {
  return machine.label ?? machine.openstack?.name ?? machine.ipv4
}
