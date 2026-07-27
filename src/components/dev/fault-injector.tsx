import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { API_BASE_URL } from "@/lib/api/client"
import {
  FAULT_DESCRIPTIONS,
  FAULT_LABELS,
  type Fault,
  devApiAvailable,
  devFaultsQueryOptions,
  faultSchema,
  useClearFaultsMutation,
  useSetFaultMutation,
} from "@/lib/queries/dev-faults"
import { machineName, machinesQueryOptions } from "@/lib/queries/machines"
import { useQuery } from "@tanstack/react-query"
import { FlaskConical, RotateCcw } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"

/**
 * Dev-only fault injection, reachable from anywhere.
 *
 * Production hits unreachable hosts, dead snmpd services and servers that
 * vanish from OpenStack. None of that can be provoked against a real fleet, so
 * the mock backend fakes each condition per machine and this panel drives it.
 * Nothing here exists on the real backend.
 */
export function FaultInjectorButton() {
  const [open, setOpen] = React.useState(false)
  const { data: faults } = useQuery({
    ...devFaultsQueryOptions(),
    // Polled while shut so the badge is right when the panel is opened.
    refetchInterval: 10_000,
  })

  const active = Object.values(faults?.faults ?? {}).filter(
    (fault) => fault !== "none"
  ).length

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          // Clear of both devtools launchers, which sit in the bottom corners.
          <Button
            variant="outline"
            size="icon-lg"
            aria-label="Inject faults (dev)"
            className="fixed right-4 bottom-16 z-50 rounded-full shadow-md"
          >
            <FlaskConical />
            {active > 0 ? (
              <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[0.625rem] font-medium text-background">
                {active}
              </span>
            ) : null}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Fault injection
            <Badge variant="secondary">dev only</Badge>
          </DialogTitle>
          <DialogDescription>
            Fakes the failure modes production will have, so the UI can be
            checked against them.
          </DialogDescription>
        </DialogHeader>
        {devApiAvailable ? (
          <FaultList active={active} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Only the Vite dev mock serves <code>/__dev/faults</code>. Unset{" "}
            <code>VITE_API_BASE_URL</code> (currently{" "}
            <code>{API_BASE_URL}</code>) and reload to simulate faults.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}

function FaultList({ active }: { active: number }) {
  const { data: machines } = useQuery(machinesQueryOptions())
  const { data: faults } = useQuery(devFaultsQueryOptions())
  const setFault = useSetFaultMutation()
  const clearFaults = useClearFaultsMutation()

  const items: Record<string, string> = Object.fromEntries(
    faultSchema.options.map((fault) => [fault, FAULT_LABELS[fault]])
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="max-h-[60vh] overflow-y-auto">
        {(machines ?? []).map((machine, index) => {
          const current = faults?.faults[machine.mac] ?? "none"
          return (
            <div key={machine.mac}>
              {index > 0 ? <Separator /> : null}
              <div className="flex flex-wrap items-center gap-3 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium">
                    {machineName(machine)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {FAULT_DESCRIPTIONS[current]}
                  </span>
                </div>
                <Select
                  items={items}
                  value={current}
                  onValueChange={(next) =>
                    setFault.mutate(
                      { mac: machine.mac, fault: next as Fault },
                      {
                        onSuccess: ({ fault }) =>
                          toast.success(
                            `${machineName(machine)}: ${FAULT_LABELS[fault]}`
                          ),
                      }
                    )
                  }
                >
                  <SelectTrigger className="min-w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {faultSchema.options.map((fault) => (
                        <SelectItem key={fault} value={fault}>
                          {FAULT_LABELS[fault]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )
        })}
      </div>
      <Button
        variant="outline"
        className="w-full"
        disabled={active === 0 || clearFaults.isPending}
        onClick={() =>
          clearFaults.mutate(undefined, {
            onSuccess: (result) =>
              toast.success(`Cleared ${result.cleared} faults`),
          })
        }
      >
        <RotateCcw data-icon="inline-start" />
        Clear all
      </Button>
    </div>
  )
}
