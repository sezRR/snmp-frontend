import { api } from "@/lib/api/client"
import type { Worker, WorkerCreate } from "@/lib/api/types"
import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

export const workersQueryOptions = () =>
  queryOptions({
    queryKey: ["workers"],
    queryFn: () => api.get<Worker[]>("/api/v1/snmp/workers"),
  })

export const workerQueryOptions = (workerId: string) =>
  queryOptions({
    queryKey: ["workers", workerId],
    queryFn: async () => {
      const workers = await api.get<Worker[]>("/api/v1/snmp/workers")
      const worker = workers.find((w) => w.id === workerId)
      if (!worker) throw new Error(`Worker ${workerId} not found`)
      return worker
    },
  })

export function useCreateWorkerMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: WorkerCreate) =>
      api.post<Worker>("/api/v1/snmp/workers", body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: workersQueryOptions().queryKey,
      })
    },
  })
}
