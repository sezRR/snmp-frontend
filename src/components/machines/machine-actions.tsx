import { ManageMachineCredentialDialog } from "@/components/machines/manage-machine-credential-dialog"
import { PurgeCutoffField } from "@/components/metrics/purge-cutoff-field"
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/client"
import type { Machine, PurgeResult } from "@/lib/api/types"
import { machineUpdateSchema } from "@/lib/api/types"
import { useHasScope } from "@/lib/auth/rbac"
import { SCOPES } from "@/lib/auth/scopes"
import { formatCount } from "@/lib/format"
import { useForceTickMutation } from "@/lib/queries/admin"
import {
  machineName,
  useDeleteMachineMutation,
  useUpdateMachineMutation,
} from "@/lib/queries/machines"
import { usePurgeMachineMetricsMutation } from "@/lib/queries/metrics"
import { removeMachineFromViews, removeMachinesFromView } from "@/lib/views"
import { useNavigate, useParams } from "@tanstack/react-router"
import {
  Eraser,
  KeyRound,
  Minus,
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

function purgeMessage(result: PurgeResult): string {
  if (result.rows_deleted == null) return `History purged (${result.method})`
  const sources = result.rows_deleted_by_source
  if (!sources) return `Purged ${formatCount(result.rows_deleted)} stored rows`
  return (
    `Purged ${formatCount(result.rows_deleted)} stored rows (` +
    `${formatCount(sources.metrics)} raw, ` +
    `${formatCount(sources.metrics_1m)} 1m, ` +
    `${formatCount(sources.metrics_1h)} 1h)`
  )
}

interface MachineActionsProps {
  machine: Machine
  trigger?: React.ReactElement
  includeViewAction?: boolean
  onDeregistered?: () => void
}

export function MachineActions({
  machine,
  trigger,
  includeViewAction = true,
  onDeregistered,
}: MachineActionsProps) {
  const [editing, setEditing] = React.useState(false)
  const [managingCredential, setManagingCredential] = React.useState(false)
  const [confirmingDelete, setConfirmingDelete] = React.useState(false)
  const [confirmingPurge, setConfirmingPurge] = React.useState(false)
  const [cutoff, setCutoff] = React.useState<Date | undefined>(undefined)
  const [label, setLabel] = React.useState(machine.label ?? "")
  const [ipv4, setIpv4] = React.useState(machine.ipv4)
  const [editError, setEditError] = React.useState<string | null>(null)

  const canEdit = useHasScope(SCOPES.machinesWrite)
  const canManageCredential = useHasScope(SCOPES.credentialsWrite)
  const canPurge = useHasScope(SCOPES.metricsWrite)
  const canTick = useHasScope(SCOPES.adminWrite)

  const navigate = useNavigate()
  const { mac: openMac, viewId } = useParams({ strict: false })
  const viewAction = includeViewAction ? viewId : undefined
  const update = useUpdateMachineMutation()
  const remove = useDeleteMachineMutation()
  const purge = usePurgeMachineMetricsMutation()
  const tick = useForceTickMutation()

  const handleEdit = (event: React.FormEvent) => {
    event.preventDefault()

    const address = ipv4.trim()
    const movedTo =
      machine.external && address !== machine.ipv4 ? address : undefined
    if (movedTo !== undefined) {
      const parsed = machineUpdateSchema.shape.ipv4.safeParse(movedTo)
      if (!parsed.success) {
        setEditError(parsed.error.issues[0]?.message ?? "Enter a valid address")
        return
      }
    }
    setEditError(null)

    update.mutate(
      { mac: machine.mac, label: label.trim() || null, ipv4: movedTo },
      {
        onSuccess: (updated) => {
          toast.success(
            movedTo
              ? `${machineName(updated)} now polled at ${updated.ipv4}`
              : `Renamed to ${machineName(updated)}`
          )
          setEditing(false)
        },
        onError: (error) => toast.error(errorMessage(error, "Update failed")),
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

  const handleRetry = () => {
    tick.mutate(undefined, {
      onSuccess: () => toast.success("Collection round triggered"),
      onError: (error) => toast.error(errorMessage(error, "Force tick failed")),
    })
  }

  const handlePurge = () => {
    purge.mutate(
      { mac: machine.mac, before: cutoff?.toISOString() },
      {
        onSuccess: (result) => toast.success(purgeMessage(result)),
        onError: (error) => toast.error(errorMessage(error, "Purge failed")),
        onSettled: () => setConfirmingPurge(false),
      }
    )
  }

  const handleDelete = () => {
    remove.mutate(machine.mac, {
      onSuccess: () => {
        removeMachineFromViews(machine.mac)
        toast.success(`Deregistered ${machineName(machine)}`)
        setConfirmingDelete(false)
        if (openMac === machine.mac) void navigate({ to: "/machines" })
        onDeregistered?.()
      },
      onError: (error) => toast.error(errorMessage(error, "Delete failed")),
    })
  }

  if (
    !canEdit &&
    !canManageCredential &&
    !canPurge &&
    !canTick &&
    !viewAction
  ) {
    return null
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            trigger ?? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Machine actions"
              >
                <MoreHorizontal />
              </Button>
            )
          }
        />
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuGroup>
            {canEdit ? (
              <>
                <DropdownMenuItem
                  onClick={() => {
                    setLabel(machine.label ?? "")
                    setIpv4(machine.ipv4)
                    setEditError(null)
                    setEditing(true)
                  }}
                >
                  <Pencil />
                  {machine.external ? "Edit" : "Rename"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleToggleEnabled}>
                  <Power />
                  {machine.enabled ? "Disable polling" : "Enable polling"}
                </DropdownMenuItem>
              </>
            ) : null}
            {canManageCredential ? (
              <DropdownMenuItem onClick={() => setManagingCredential(true)}>
                <KeyRound />
                Manage credential
              </DropdownMenuItem>
            ) : null}
            {canTick ? (
              <DropdownMenuItem onClick={handleRetry} disabled={tick.isPending}>
                <RefreshCw />
                Retry now
              </DropdownMenuItem>
            ) : null}
            {viewAction ? (
              <DropdownMenuItem
                onClick={() => {
                  removeMachinesFromView(viewAction, [machine.mac])
                  toast.success(`Removed ${machineName(machine)} from the view`)
                }}
              >
                <Minus />
                Remove from view
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
          {canPurge || canEdit ? <DropdownMenuSeparator /> : null}
          <DropdownMenuGroup>
            {canPurge ? (
              <DropdownMenuItem onClick={() => setConfirmingPurge(true)}>
                <Eraser />
                Purge history
              </DropdownMenuItem>
            ) : null}
            {canEdit ? (
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirmingDelete(true)}
              >
                <Trash2 />
                Deregister
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <ManageMachineCredentialDialog
        machine={machine}
        open={managingCredential}
        onOpenChange={setManagingCredential}
      />

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {machine.external ? "Edit machine" : "Rename machine"}
            </DialogTitle>
            <DialogDescription>
              {machine.external
                ? "An external machine's address is yours to move, since nothing upstream knows where it went. Its MAC stays fixed as its identity."
                : "The label is yours; the MAC and address come from OpenStack."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="machine-label-edit">Label</FieldLabel>
                <Input
                  id="machine-label-edit"
                  value={label}
                  placeholder={machine.ipv4}
                  onChange={(event) => setLabel(event.target.value)}
                />
              </Field>
              {machine.external ? (
                <Field>
                  <FieldLabel htmlFor="machine-ipv4-edit">
                    IPv4 address
                  </FieldLabel>
                  <Input
                    id="machine-ipv4-edit"
                    value={ipv4}
                    aria-invalid={editError ? true : undefined}
                    onChange={(event) => setIpv4(event.target.value)}
                  />
                  <FieldDescription>
                    Polling moves to this address on the next collection round.
                  </FieldDescription>
                </Field>
              ) : null}
              {editError ? <FieldError>{editError}</FieldError> : null}
            </FieldGroup>
            <DialogFooter className="mt-6">
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? <Spinner data-icon="inline-start" /> : null}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmingPurge}
        onOpenChange={(next) => {
          setConfirmingPurge(next)
          if (!next) setCutoff(undefined)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Purge history?</DialogTitle>
            <DialogDescription>
              Deletes stored samples for {machineName(machine)}. The machine
              stays registered and keeps being polled.
            </DialogDescription>
          </DialogHeader>
          <PurgeCutoffField
            id="machine-purge-cutoff"
            value={cutoff}
            onChange={setCutoff}
            disabled={purge.isPending}
          />
          <DialogFooter className="mt-2">
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
