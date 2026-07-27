import { MachineCard } from "@/components/machines/machine-card"
import { useMachineSamples } from "@/hooks/use-machine-samples"
import type { Machine } from "@/lib/api/types"
import {
  collectorMachineHealth,
  collectorStatusQueryOptions,
} from "@/lib/queries/admin"
import { useQuery } from "@tanstack/react-query"

/**
 * The card grid shared by the dashboard and saved views. Live samples arrive
 * over one fleet-wide SSE connection; /metrics/latest fills the cards before
 * the first event lands.
 */
export function MachineGrid({ machines }: { machines: Machine[] }) {
  const { data: collector } = useQuery(collectorStatusQueryOptions())
  const samples = useMachineSamples()

  const health = collectorMachineHealth(collector)

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {machines.map((machine) => (
        <MachineCard
          key={machine.mac}
          machine={machine}
          sample={samples[machine.mac]}
          failing={health[machine.mac]?.failing}
        />
      ))}
    </div>
  )
}
