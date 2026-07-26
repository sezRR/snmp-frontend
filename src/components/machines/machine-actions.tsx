import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/client"
import type { Machine } from "@/lib/api/types"
import { useForceTickMutation } from "@/lib/queries/admin"
import {
  machineName,
  useDeleteMachineMutation,
  useUpdateMachineMutation,
} from "@/lib/queries/machines"
import { usePurgeMachineMetricsMutation } from "@/lib/queries/metrics"
import { forgetMachine } from "@/lib/recent-machines"
import { useNavigate, useParams } from "@tanstack/react-router"
import {
  Eraser,
  MoreHorizontal,
  Pencil,
  Power,
  RefreshCw,
  Trash2,
} from "lucide-react"
import * as React from "react"
import { toast } from "sonner"

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

interface MachineActionsProps {
  machine: Machine
}

export function MachineActions({ machine }: MachineActionsProps) {
  const [renaming, setRenaming] = React.useState(false)
  const [confirmingDelete, setConfirmingDelete] = React.useState(false)
  const [confirmingPurge, setConfirmingPurge] = React.useState(false)
  const [label, setLabel] = React.useState(machine.label ?? "")

  const navigate = useNavigate()
  // Only the machine's own detail page has to be left behind after a delete;
  // from a list the row just disappears and the user stays put.
  const { mac: openMac } = useParams({ strict: false })
  const update = useUpdateMachineMutation()
  const remove = useDeleteMachineMutation()
  const purge = usePurgeMachineMetricsMutation()
  const tick = useForceTickMutation()

  const handleRename = (event: React.FormEvent) => {
    event.preventDefault()
    update.mutate(
      { mac: machine.mac, label: label.trim() || null },
      {
        onSuccess: (updated) => {
          toast.success(`Renamed to ${machineName(updated)}`)
          setRenaming(false)
        },
        onError: (error) => toast.error(errorMessage(error, "Rename failed")),
      }
    )
  }

  const handleToggleEnabled = () => {
    update.mutate(
      { mac: machine.mac, enabled: !machine.enabled },
      {
        onSuccess: (updated) =>
          toast.success(
            updated.enabled ? "Polling enabled" : "Polling disabled"
          ),
        onError: (error) => toast.error(errorMessage(error, "Update failed")),
      }
    )
  }

  // There is no per-machine retry endpoint; forcing a collection round is the
  // way to re-poll a machine that just started failing.
  const handleRetry = () => {
    tick.mutate(undefined, {
      onSuccess: () => toast.success("Collection round triggered"),
      onError: (error) => toast.error(errorMessage(error, "Force tick failed")),
    })
  }

  const handlePurge = () => {
    purge.mutate(
      { mac: machine.mac },
      {
        onSuccess: (result) =>
          toast.success(
            result.rows_deleted === null || result.rows_deleted === undefined
              ? `History purged (${result.method})`
              : `Purged ${result.rows_deleted} samples`
          ),
        onError: (error) => toast.error(errorMessage(error, "Purge failed")),
        onSettled: () => setConfirmingPurge(false),
      }
    )
  }

  const handleDelete = () => {
    remove.mutate(machine.mac, {
      onSuccess: () => {
        forgetMachine(machine.mac)
        toast.success(`Deregistered ${machineName(machine)}`)
        setConfirmingDelete(false)
        if (openMac === machine.mac) void navigate({ to: "/machines" })
      },
      onError: (error) => toast.error(errorMessage(error, "Delete failed")),
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="Machine actions">
              <MoreHorizontal />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem
            onClick={() => {
              setLabel(machine.label ?? "")
              setRenaming(true)
            }}
          >
            <Pencil />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleToggleEnabled}>
            <Power />
            {machine.enabled ? "Disable polling" : "Enable polling"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleRetry} disabled={tick.isPending}>
            <RefreshCw />
            Retry now
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setConfirmingPurge(true)}>
            <Eraser />
            Purge history
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 />
            Deregister
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename machine</DialogTitle>
            <DialogDescription>
              The label is yours; the MAC and address come from OpenStack.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRename}>
            <Field>
              <FieldLabel htmlFor="machine-label-edit">Label</FieldLabel>
              <Input
                id="machine-label-edit"
                value={label}
                placeholder={machine.ipv4}
                onChange={(event) => setLabel(event.target.value)}
              />
            </Field>
            <DialogFooter className="mt-6">
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? <Spinner data-icon="inline-start" /> : null}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmingPurge} onOpenChange={setConfirmingPurge}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Purge history?</DialogTitle>
            <DialogDescription>
              Deletes every stored sample for {machineName(machine)}. The
              machine stays registered and keeps being polled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmingPurge(false)}
              disabled={purge.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handlePurge}
              disabled={purge.isPending}
            >
              {purge.isPending ? <Spinner data-icon="inline-start" /> : null}
              Purge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Deregister machine?</DialogTitle>
            <DialogDescription>
              {machineName(machine)} stops being polled and its entire metric
              history is deleted with it. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmingDelete(false)}
              disabled={remove.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={remove.isPending}
            >
              {remove.isPending ? <Spinner data-icon="inline-start" /> : null}
              Deregister
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
