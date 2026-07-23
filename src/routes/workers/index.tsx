import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { AddWorkerDialog } from "@/components/workers/add-worker-dialog"
import type { Worker } from "@/lib/api/types"
import { formatRelativeTime } from "@/lib/format"
import { workersQueryOptions } from "@/lib/queries/workers"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { Server } from "lucide-react"

export const Route = createFileRoute("/workers/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(workersQueryOptions()),
  pendingComponent: () => <Skeleton className="h-64 rounded-xl" />,
  component: WorkersPage,
})

const statusVariant: Record<
  Worker["status"],
  "default" | "destructive" | "secondary"
> = {
  up: "default",
  down: "destructive",
  unknown: "secondary",
}

function WorkersPage() {
  const { data: workers } = useSuspenseQuery(workersQueryOptions())

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Workers</h1>
        <AddWorkerDialog />
      </div>
      {workers.length === 0 ? (
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
        </Empty>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Registered workers</CardTitle>
            <CardDescription>
              {workers.length} machine{workers.length === 1 ? "" : "s"} polled
              via SNMP
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col">
            {workers.map((worker, index) => (
              <div key={worker.id}>
                {index > 0 ? <Separator /> : null}
                <Link
                  to="/workers/$workerId"
                  params={{ workerId: worker.id }}
                  className="flex items-center gap-4 rounded-md px-2 py-3 outline-none hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <div className="flex flex-1 flex-col gap-0.5">
                    <span className="font-medium">
                      {worker.name ?? worker.ip}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {worker.ip} · SNMP {worker.snmp_version}
                      {worker.last_seen_at
                        ? ` · seen ${formatRelativeTime(worker.last_seen_at)}`
                        : ""}
                    </span>
                  </div>
                  <Badge variant={statusVariant[worker.status]}>
                    {worker.status}
                  </Badge>
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
