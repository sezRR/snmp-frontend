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

export function useRegisterMachineMutation() {
  const invalidate = useInvalidateMachines()
  return useMutation({
    mutationFn: (body: MachineCreate) =>
      api.post("/machines", { body, schema: machineSchema }),
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

/** Label first, then the address — a MAC alone is unreadable in a list. */
export function machineName(machine: Machine): string {
  return machine.label ?? machine.openstack?.name ?? machine.ipv4
}
