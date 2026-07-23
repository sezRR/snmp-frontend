import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { AddWorkerDialog } from "@/components/workers/add-worker-dialog"
import { WorkerCard } from "@/components/workers/worker-card"
import { workersQueryOptions } from "@/lib/queries/workers"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Server } from "lucide-react"

export const Route = createFileRoute("/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(workersQueryOptions()),
  pendingComponent: DashboardSkeleton,
  component: DashboardPage,
})

function DashboardPage() {
  const { data: workers } = useSuspenseQuery(workersQueryOptions())

  if (workers.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Server />
          </EmptyMedia>
          <EmptyTitle>No workers yet</EmptyTitle>
          <EmptyDescription>
            Add a machine with an SNMP agent to start monitoring.
          </EmptyDescription>
        </EmptyHeader>
        <AddWorkerDialog />
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <AddWorkerDialog />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {workers.map((worker) => (
          <WorkerCard key={worker.id} worker={worker} />
        ))}
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-40 rounded-xl" />
      ))}
    </div>
  )
}
