import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { Machine } from "@/lib/api/types"
import { useHasScope } from "@/lib/auth/rbac"
import { SCOPES } from "@/lib/auth/scopes"
import {
  machineName,
  machinesQueryOptions,
  useDeleteMachinesMutation,
} from "@/lib/queries/machines"
import { removeMachineFromViews } from "@/lib/views"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, useParams } from "@tanstack/react-router"
import { Trash2 } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"

interface DeregisterMachinesDialogProps {
  machines?: Machine[]
}

export function DeregisterMachinesDialog({
  machines,
}: DeregisterMachinesDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [picked, setPicked] = React.useState<string[]>([])
  const [error, setError] = React.useState<string | null>(null)

  const canDeregister = useHasScope(SCOPES.machinesWrite)
  const { data: fleet } = useQuery(machinesQueryOptions())
  const candidates = machines ?? fleet ?? []
  const remove = useDeleteMachinesMutation()

  const navigate = useNavigate()
  const { mac: openMac } = useParams({ strict: false })

  const reset = () => {
    setPicked([])
    setError(null)
    remove.reset()
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (picked.length === 0) {
      setError("Pick at least one machine")
      return
    }
    setError(null)

    remove.mutate(picked, {
      onSuccess: ({ removed, failed }) => {
        for (const mac of removed) {
          removeMachineFromViews(mac)
        }
        if (removed.length > 0) {
          toast.success(
            `Deregistered ${removed.length} machine${removed.length === 1 ? "" : "s"}`
          )
        }
        for (const failure of failed) {
          toast.error(`${failure.mac}: ${failure.reason}`)
        }
        if (openMac && removed.includes(openMac)) {
          void navigate({ to: "/machines" })
        }
        if (failed.length === 0) {
          setOpen(false)
          reset()
        } else {
          setPicked(failed.map((failure) => failure.mac))
          setError(
            `${failed.length} machine${failed.length === 1 ? "" : "s"} could not be deregistered`
          )
        }
      },
    })
  }

  if (!canDeregister) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline">
            <Trash2 data-icon="inline-start" />
            Deregister
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Deregister machines</DialogTitle>
          <DialogDescription>
            Each one stops being polled and its entire metric history is deleted
            with it. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel>
                Machines
                <span className="ml-auto flex items-center gap-1">
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    disabled={remove.isPending}
                    onClick={() =>
                      setPicked(candidates.map((machine) => machine.mac))
                    }
                  >
                    Select all {candidates.length}
                  </Button>
                  {picked.length > 0 ? (
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      disabled={remove.isPending}
                      onClick={() => setPicked([])}
                    >
                      Clear
                    </Button>
                  ) : null}
                </span>
              </FieldLabel>
              <ToggleGroup
                variant="outline"
                multiple
                className="flex max-h-56 w-full flex-wrap justify-start gap-2 overflow-y-auto"
                value={picked}
                onValueChange={(next: string[]) => setPicked(next)}
              >
                {candidates.map((machine) => (
                  <ToggleGroupItem key={machine.mac} value={machine.mac}>
                    {machineName(machine)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <FieldDescription>
                Deregistered machines are dropped from saved views too.
              </FieldDescription>
            </Field>
            {error ? <FieldError>{error}</FieldError> : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="ghost"
              disabled={remove.isPending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={remove.isPending}
            >
              {remove.isPending ? <Spinner data-icon="inline-start" /> : null}
              {picked.length > 1
                ? `Deregister ${picked.length} machines`
                : "Deregister"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
