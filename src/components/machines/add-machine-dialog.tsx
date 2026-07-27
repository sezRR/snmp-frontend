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
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { MachineCreate } from "@/lib/api/types"
import { machineCreateSchema } from "@/lib/api/types"
import { cachedServersQueryOptions } from "@/lib/queries/admin"
import {
  machineName,
  machinesQueryOptions,
  useRegisterAllMachinesMutation,
} from "@/lib/queries/machines"
import { type View, addMachinesToView } from "@/lib/views"
import { useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"

interface AddMachineDialogProps {
  /**
   * Opened from a view: everything registered or picked here joins it, which
   * is what "add a machine to this group" has to mean when the group is the
   * page the user is standing on.
   */
  view?: View
}

/**
 * Registration takes addresses only. The cached OpenStack servers are offered
 * first because picking them avoids typos and registers several at once, but
 * an address the cache does not know is registered all the same — it just
 * arrives without server facts until the lookup catches up.
 */
export function AddMachineDialog({ view }: AddMachineDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [picked, setPicked] = React.useState<string[]>([])
  const [attached, setAttached] = React.useState<string[]>([])
  const [ipv4, setIpv4] = React.useState("")
  const [label, setLabel] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)

  const register = useRegisterAllMachinesMutation()
  const { data: servers } = useQuery({
    ...cachedServersQueryOptions(),
    enabled: open,
  })
  const { data: machines } = useQuery(machinesQueryOptions())

  const registered = new Set(machines?.map((machine) => machine.mac))
  const available = (servers ?? []).filter(
    (server) => !registered.has(server.mac)
  )
  // Inside a view, a machine that is already registered but not a member is
  // added to the view rather than registered again.
  const joinable = view
    ? (machines ?? []).filter((machine) => !view.macs.includes(machine.mac))
    : []

  const reset = () => {
    setPicked([])
    setAttached([])
    setIpv4("")
    setLabel("")
    setError(null)
    register.reset()
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    const bodies: MachineCreate[] = []
    for (const address of picked) {
      const server = available.find((entry) => entry.ipv4 === address)
      // Bulk registration takes the server's own name as the label, since
      // typing one per machine is the work picking from the list avoids.
      bodies.push({ ipv4: address, label: server?.name })
    }

    const typed = ipv4.trim()
    if (typed) {
      const parsed = machineCreateSchema.safeParse({
        ipv4: typed,
        label: label.trim() || undefined,
      })
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Enter a valid address")
        return
      }
      bodies.push(parsed.data)
    }

    if (bodies.length === 0 && attached.length === 0) {
      setError(
        view
          ? "Pick a machine to add, or enter an address"
          : "Pick a server or enter an address"
      )
      return
    }

    setError(null)

    // Nothing to register: the picks are all machines the backend already
    // knows, so this is a view edit and never touches the API.
    if (bodies.length === 0 && view) {
      addMachinesToView(view.id, attached)
      toast.success(
        `Added ${attached.length} machine${attached.length === 1 ? "" : "s"} to ${view.name}`
      )
      setOpen(false)
      reset()
      return
    }

    register.mutate(bodies, {
      onSuccess: ({ registered: created, failed }) => {
        if (view) {
          addMachinesToView(view.id, [
            ...created.map((machine) => machine.mac),
            ...attached,
          ])
        }
        if (created.length === 1) {
          toast.success(`Registered ${machineName(created[0])}`)
        } else if (created.length > 1) {
          toast.success(`Registered ${created.length} machines`)
        }
        for (const failure of failed) {
          toast.error(`${failure.ipv4}: ${failure.reason}`)
        }
        // Failures keep the dialog open with the selection intact, so the
        // addresses that did not take can be retried or corrected.
        if (failed.length === 0) {
          setOpen(false)
          reset()
        } else {
          setError(
            `${failed.length} address${failed.length === 1 ? "" : "es"} failed`
          )
        }
      },
    })
  }

  const total = picked.length + attached.length + (ipv4.trim() ? 1 : 0)

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
          <Button>
            <Plus data-icon="inline-start" />
            {view ? "Add machines" : "Add machine"}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {view ? `Add machines to ${view.name}` : "Register machines"}
          </DialogTitle>
          <DialogDescription>
            Pick as many cached OpenStack servers as you like, or type an
            address. Addresses OpenStack does not know are polled too, without
            server facts.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            {available.length > 0 ? (
              <Field>
                <FieldLabel>
                  OpenStack servers
                  <span className="ml-auto flex items-center gap-1">
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() =>
                        setPicked(available.map((server) => server.ipv4))
                      }
                    >
                      Select all {available.length}
                    </Button>
                    {picked.length > 0 ? (
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
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
                  className="flex max-h-44 w-full flex-wrap justify-start gap-2 overflow-y-auto"
                  value={picked}
                  onValueChange={(next: string[]) => setPicked(next)}
                >
                  {available.map((server) => (
                    <ToggleGroupItem key={server.mac} value={server.ipv4}>
                      {server.name} · {server.ipv4}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>
            ) : null}

            {joinable.length > 0 ? (
              <Field>
                <FieldLabel>Already registered</FieldLabel>
                <ToggleGroup
                  variant="outline"
                  multiple
                  className="flex max-h-44 w-full flex-wrap justify-start gap-2 overflow-y-auto"
                  value={attached}
                  onValueChange={(next: string[]) => setAttached(next)}
                >
                  {joinable.map((machine) => (
                    <ToggleGroupItem key={machine.mac} value={machine.mac}>
                      {machineName(machine)}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <FieldDescription>
                  Added to this view without touching the backend.
                </FieldDescription>
              </Field>
            ) : null}

            <Field>
              <FieldLabel htmlFor="machine-ipv4">IPv4 address</FieldLabel>
              <Input
                id="machine-ipv4"
                placeholder="192.168.1.10"
                value={ipv4}
                aria-invalid={error && ipv4.trim() ? true : undefined}
                onChange={(event) => setIpv4(event.target.value)}
              />
              <FieldDescription>
                Any reachable address. Machines OpenStack has no record of are
                polled all the same; their flavor limits stay unknown until the
                lookup finds them.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="machine-label">Label (optional)</FieldLabel>
              <Input
                id="machine-label"
                placeholder="core-worker-01"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
              />
              <FieldDescription>
                Applies to the typed address; picked servers keep their
                OpenStack name.
              </FieldDescription>
            </Field>

            {error ? <FieldError>{error}</FieldError> : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={register.isPending}>
              {register.isPending ? <Spinner data-icon="inline-start" /> : null}
              {total > 1 ? `Add ${total} machines` : "Add machine"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
