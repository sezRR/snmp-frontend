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
import { SCOPES, useHasScope } from "@/lib/auth/scopes"
import { useCachedServersQuery } from "@/lib/queries/admin"
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
 * Registration takes an address, plus a MAC when the address is outside the
 * OpenStack fleet. The cached servers are offered first because picking them
 * avoids typos, registers several at once and resolves their MACs for free;
 * anything else is registered as an external machine, named by the MAC typed
 * here since nothing upstream can name it.
 */
export function AddMachineDialog({ view }: AddMachineDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [picked, setPicked] = React.useState<string[]>([])
  const [attached, setAttached] = React.useState<string[]>([])
  const [ipv4, setIpv4] = React.useState("")
  const [mac, setMac] = React.useState("")
  const [label, setLabel] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)

  const canRegister = useHasScope(SCOPES.machinesWrite)
  const register = useRegisterAllMachinesMutation()
  // The picker is a convenience the OpenStack cache provides, and reading it
  // is an admin scope — without it, registration still works by typing an
  // address, which is the path every external machine takes anyway.
  const { data: servers } = useCachedServersQuery({ enabled: open })
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
    setMac("")
    setLabel("")
    setError(null)
    register.reset()
  }

  const typedAddress = ipv4.trim()
  // The cache is exactly what the backend resolves a MAC from, so an address
  // missing here is the address that has to be named by hand.
  const cached = (servers ?? []).find((entry) => entry.ipv4 === typedAddress)
  const macRequired = Boolean(typedAddress) && servers !== undefined && !cached

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    const bodies: MachineCreate[] = []
    for (const address of picked) {
      const server = available.find((entry) => entry.ipv4 === address)
      // Bulk registration takes the server's own name as the label, since
      // typing one per machine is the work picking from the list avoids.
      bodies.push({ ipv4: address, label: server?.name })
    }

    if (typedAddress) {
      const parsed = machineCreateSchema.safeParse({
        ipv4: typedAddress,
        mac: mac.trim() || undefined,
        label: label.trim() || undefined,
      })
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Enter a valid address")
        return
      }
      if (macRequired && !parsed.data.mac) {
        setError(
          `OpenStack has no record of ${typedAddress} — enter its MAC to register it as an external machine`
        )
        return
      }
      // The fleet names its own machines: sending a MAC that disagrees with
      // the lookup is a 422, and catching it here says which one is wrong.
      if (
        cached &&
        parsed.data.mac &&
        parsed.data.mac !== cached.mac.toLowerCase().replaceAll("-", ":")
      ) {
        setError(
          `OpenStack knows ${typedAddress} as ${cached.mac} — clear the MAC or correct it`
        )
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

  const total = picked.length + attached.length + (typedAddress ? 1 : 0)

  // Registration needs `machines:write`. Inside a view the dialog still earns
  // its place without it — adding an already-registered machine to a view is
  // local state that never reaches the backend — so only the register half
  // goes away there, and everywhere else the button does.
  if (!canRegister && !view) return null

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
            {canRegister
              ? "Pick as many cached OpenStack servers as you like, or type an address. An address OpenStack does not know is registered as an external machine, identified by the MAC you give it."
              : "Machines already registered can join this view. Registering a new one needs the machines:write scope."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            {canRegister && available.length > 0 ? (
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

            {canRegister ? (
              <>
                <Field>
                  <FieldLabel htmlFor="machine-ipv4">IPv4 address</FieldLabel>
                  <Input
                    id="machine-ipv4"
                    placeholder="192.168.1.10"
                    value={ipv4}
                    aria-invalid={error && typedAddress ? true : undefined}
                    onChange={(event) => setIpv4(event.target.value)}
                  />
                  <FieldDescription>
                    Any reachable address. One OpenStack has no record of is
                    polled all the same, as an external machine — with no flavor
                    limits and an address only you can change.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="machine-mac">
                    MAC address {macRequired ? null : "(optional)"}
                  </FieldLabel>
                  <Input
                    id="machine-mac"
                    placeholder="fa:16:3e:00:00:01"
                    className="font-mono"
                    value={mac}
                    aria-invalid={
                      error && macRequired && !mac.trim() ? true : undefined
                    }
                    onChange={(event) => setMac(event.target.value)}
                  />
                  <FieldDescription>
                    {macRequired
                      ? `OpenStack has no record of ${typedAddress}, so its MAC — the machine's identity here — has to come from you.`
                      : "Only needed for addresses outside the OpenStack fleet; the lookup resolves the rest."}
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="machine-label">
                    Label (optional)
                  </FieldLabel>
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
              </>
            ) : null}

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
