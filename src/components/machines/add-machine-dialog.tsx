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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/client"
import { machineCreateSchema } from "@/lib/api/types"
import { cachedServersQueryOptions } from "@/lib/queries/admin"
import {
  machinesQueryOptions,
  useRegisterMachineMutation,
} from "@/lib/queries/machines"
import { useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"

const MANUAL = "__manual__"

/**
 * Registration takes an address only: the backend resolves the MAC from
 * OpenStack, so an address OpenStack does not know cannot be registered. The
 * cached server list is offered first for exactly that reason.
 */
export function AddMachineDialog() {
  const [open, setOpen] = React.useState(false)
  const [choice, setChoice] = React.useState<string>(MANUAL)
  const [ipv4, setIpv4] = React.useState("")
  const [label, setLabel] = React.useState("")
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const mutation = useRegisterMachineMutation()
  const { data: servers } = useQuery({
    ...cachedServersQueryOptions(),
    enabled: open,
  })
  const { data: machines } = useQuery(machinesQueryOptions())

  const registered = new Set(machines?.map((machine) => machine.mac))
  const available = (servers ?? []).filter(
    (server) => !registered.has(server.mac)
  )
  const items: Record<string, string> = {
    ...Object.fromEntries(
      available.map((server) => [
        server.ipv4,
        `${server.name} · ${server.ipv4}`,
      ])
    ),
    [MANUAL]: "Enter an address manually",
  }

  const reset = () => {
    setChoice(MANUAL)
    setIpv4("")
    setLabel("")
    setErrors({})
    mutation.reset()
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const address = choice === MANUAL ? ipv4.trim() : choice
    const result = machineCreateSchema.safeParse({
      ipv4: address,
      label: label.trim() || undefined,
    })
    if (!result.success) {
      setErrors(
        Object.fromEntries(
          result.error.issues.map((issue) => [
            issue.path.join("."),
            issue.message,
          ])
        )
      )
      return
    }

    setErrors({})
    mutation.mutate(result.data, {
      onSuccess: (machine) => {
        // Stay where the user was; the new machine appears in the list behind
        // the dialog on its own.
        toast.success(`Registered ${machine.label ?? machine.ipv4}`)
        setOpen(false)
        reset()
      },
    })
  }

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
            Add machine
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Register machine</DialogTitle>
          <DialogDescription>
            The MAC is resolved from OpenStack and becomes the machine&apos;s
            identity here.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            {available.length > 0 ? (
              <Field>
                <FieldLabel>OpenStack server</FieldLabel>
                <Select
                  value={choice}
                  onValueChange={(value) => setChoice(value as string)}
                  items={items}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {available.map((server) => (
                        <SelectItem key={server.mac} value={server.ipv4}>
                          {server.name} · {server.ipv4}
                        </SelectItem>
                      ))}
                      <SelectItem value={MANUAL}>
                        Enter an address manually
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            ) : null}

            {choice === MANUAL ? (
              <Field data-invalid={errors.ipv4 ? true : undefined}>
                <FieldLabel htmlFor="machine-ipv4">IPv4 address</FieldLabel>
                <Input
                  id="machine-ipv4"
                  placeholder="192.168.1.10"
                  value={ipv4}
                  aria-invalid={errors.ipv4 ? true : undefined}
                  onChange={(event) => setIpv4(event.target.value)}
                />
                {errors.ipv4 ? <FieldError>{errors.ipv4}</FieldError> : null}
              </Field>
            ) : null}

            <Field>
              <FieldLabel htmlFor="machine-label">Label (optional)</FieldLabel>
              <Input
                id="machine-label"
                placeholder="core-worker-01"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
              />
            </Field>

            {mutation.isError ? (
              <FieldError>
                {mutation.error instanceof ApiError
                  ? mutation.error.message
                  : "Failed to register machine"}
              </FieldError>
            ) : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner data-icon="inline-start" /> : null}
              Register
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
