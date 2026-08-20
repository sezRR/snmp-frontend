import {
  type CredentialDraft,
  type CredentialErrors,
  SnmpCredentialFields,
  credentialDraftFrom,
  credentialShapeChanged,
  emptyCredentialDraft,
  parseCredentialDraft,
  parseCredentialMetadataDraft,
} from "@/components/machines/snmp-credential-fields"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup } from "@/components/ui/field"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/client"
import type {
  Machine,
  SnmpCredential,
  SnmpCredentialForm,
} from "@/lib/api/types"
import { useHasScope } from "@/lib/auth/rbac"
import { SCOPES } from "@/lib/auth/scopes"
import {
  credentialSummary,
  useBindCredentialMutation,
  useCreateCredentialMutation,
  useCredentialsQuery,
  useDeleteCredentialMutation,
  useUnbindCredentialMutation,
  useUpdateCredentialMutation,
} from "@/lib/queries/credentials"
import { machineName, machinesQueryOptions } from "@/lib/queries/machines"
import { useQuery } from "@tanstack/react-query"
import {
  CircleAlert,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  Trash2,
  Unplug,
} from "lucide-react"
import * as React from "react"
import { toast } from "sonner"

type DialogMode = "create" | "edit" | "delete" | "bindings" | null

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

function countBindings(
  credentialId: string,
  machines: Machine[] | undefined
): number | null {
  if (!machines) return null
  return machines.filter((machine) => machine.credential_id === credentialId)
    .length
}

export function CredentialsAdminCard() {
  const canRead = useHasScope(SCOPES.credentialsRead)
  const canWrite = useHasScope(SCOPES.credentialsWrite)
  const canReadMachines = useHasScope(SCOPES.machinesRead)
  const canManageBindings = canReadMachines && canWrite

  const credentialsQuery = useCredentialsQuery()
  const machinesQuery = useQuery({
    ...machinesQueryOptions(),
    enabled: canManageBindings,
  })
  const createCredential = useCreateCredentialMutation()
  const updateCredential = useUpdateCredentialMutation()
  const deleteCredential = useDeleteCredentialMutation()
  const bindCredential = useBindCredentialMutation()
  const unbindCredential = useUnbindCredentialMutation()

  const [dialog, setDialog] = React.useState<DialogMode>(null)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState<CredentialDraft>({
    ...emptyCredentialDraft,
  })
  const [draftErrors, setDraftErrors] = React.useState<CredentialErrors>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  const [bindingError, setBindingError] = React.useState<string | null>(null)
  const [bindingMac, setBindingMac] = React.useState<string | null>(null)
  const [confirmingMac, setConfirmingMac] = React.useState<string | null>(null)

  const credentials = credentialsQuery.data ?? []
  const selected =
    credentials.find((credential) => credential.id === selectedId) ?? null
  const selectedBoundCount =
    selected && canManageBindings
      ? countBindings(selected.id, machinesQuery.data)
      : null
  const formPending = createCredential.isPending || updateCredential.isPending
  const bindingPending = bindCredential.isPending || unbindCredential.isPending

  const resetDialog = () => {
    setDialog(null)
    setSelectedId(null)
    setDraft({ ...emptyCredentialDraft })
    setDraftErrors({})
    setFormError(null)
    setDeleteError(null)
    setBindingError(null)
    setBindingMac(null)
    setConfirmingMac(null)
  }

  const openCreate = () => {
    if (!canWrite) return
    setSelectedId(null)
    setDraft({ ...emptyCredentialDraft })
    setDraftErrors({})
    setFormError(null)
    setDialog("create")
  }

  const openEdit = (credential: SnmpCredential) => {
    if (!canWrite) return
    setSelectedId(credential.id)
    setDraft(credentialDraftFrom(credential))
    setDraftErrors({})
    setFormError(null)
    setDialog("edit")
  }

  const openDelete = (credential: SnmpCredential) => {
    if (!canWrite) return
    setSelectedId(credential.id)
    setDeleteError(null)
    setDialog("delete")
  }

  const openBindings = (credential: SnmpCredential) => {
    if (!canManageBindings) return
    setSelectedId(credential.id)
    setBindingError(null)
    setDialog("bindings")
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canWrite) return

    setFormError(null)
    if (dialog === "create") {
      const parsed = parseCredentialDraft(draft)
      setDraftErrors(parsed.errors)
      if (!parsed.data) {
        setFormError("Fix the highlighted fields")
        return
      }

      try {
        const created = await createCredential.mutateAsync(parsed.data)
        toast.success(`Created ${created.name}`)
        resetDialog()
      } catch (error) {
        setFormError(errorMessage(error, "Credential creation failed"))
      }
      return
    }

    if (dialog !== "edit" || !selected) return
    const shapeChanged = credentialShapeChanged(draft, selected)
    let patch: Partial<SnmpCredentialForm>

    if (shapeChanged) {
      const parsed = parseCredentialDraft(draft)
      setDraftErrors(parsed.errors)
      if (!parsed.data) {
        setFormError("Fix the highlighted fields")
        return
      }
      patch = { ...parsed.data, description: draft.description }
    } else {
      const parsed = parseCredentialMetadataDraft(draft)
      setDraftErrors(parsed.errors)
      if (!parsed.data) {
        setFormError("Fix the highlighted fields")
        return
      }
      patch = parsed.data
    }

    try {
      const updated = await updateCredential.mutateAsync({
        id: selected.id,
        patch,
      })
      toast.success(`Updated ${updated.name}`)
      resetDialog()
    } catch (error) {
      setFormError(errorMessage(error, "Credential update failed"))
    }
  }

  const handleDelete = async () => {
    if (!canWrite || !selected || (selectedBoundCount ?? 0) > 0) return
    setDeleteError(null)
    try {
      await deleteCredential.mutateAsync(selected.id)
      toast.success(`Deleted ${selected.name}`)
      resetDialog()
    } catch (error) {
      setDeleteError(errorMessage(error, "Credential deletion failed"))
    }
  }

  const handleBinding = async (machine: Machine) => {
    if (!canManageBindings || !selected) return
    const unbinding = machine.credential_id === selected.id
    const replacing = !unbinding && Boolean(machine.credential_id)
    setBindingError(null)
    setBindingMac(machine.mac)

    try {
      if (unbinding) {
        await unbindCredential.mutateAsync(machine.mac)
        toast.success(`Unbound ${selected.name} from ${machineName(machine)}`)
      } else {
        await bindCredential.mutateAsync({
          mac: machine.mac,
          credentialId: selected.id,
        })
        toast.success(
          replacing
            ? `Replaced the credential on ${machineName(machine)} with ${selected.name}`
            : `Bound ${selected.name} to ${machineName(machine)}`
        )
      }
      setConfirmingMac(null)
    } catch (error) {
      setBindingError(
        errorMessage(
          error,
          unbinding ? "Credential unbind failed" : "Credential bind failed"
        )
      )
    } finally {
      setBindingMac(null)
    }
  }

  const formOpen = dialog === "create" || dialog === "edit"
  const formDialog = (
    <Dialog
      open={formOpen}
      onOpenChange={(open) => {
        if (!open && !formPending) resetDialog()
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {dialog === "edit"
              ? `Edit ${selected?.name ?? "credential"}`
              : "New SNMP credential"}
          </DialogTitle>
          <DialogDescription>
            {dialog === "edit"
              ? "Name and description can change alone. Changing SNMP settings or rotating a secret requires the complete credential."
              : "Create a reusable SNMPv2c or SNMPv3 profile. Secrets are encrypted and cannot be read back."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void handleSave(event)}>
          <div className="max-h-[62vh] overflow-y-auto px-1">
            <FieldGroup>
              {dialog === "edit" &&
              selectedBoundCount !== null &&
              selectedBoundCount > 0 ? (
                <Alert>
                  <CircleAlert />
                  <AlertTitle>Shared profile</AlertTitle>
                  <AlertDescription>
                    Saving this credential updates the profile used by{" "}
                    {selectedBoundCount} machine
                    {selectedBoundCount === 1 ? "" : "s"} on the next collection
                    round.
                  </AlertDescription>
                </Alert>
              ) : null}

              {dialog === "edit" &&
              selected &&
              credentialShapeChanged(draft, selected) ? (
                <Alert>
                  <KeyRound />
                  <AlertTitle>Complete replacement required</AlertTitle>
                  <AlertDescription>
                    Returned profiles omit secrets. Enter every secret required
                    by the selected SNMP shape before saving this change.
                  </AlertDescription>
                </Alert>
              ) : null}

              <SnmpCredentialFields
                draft={draft}
                errors={draftErrors}
                disabled={formPending}
                idPrefix={
                  dialog === "edit"
                    ? "admin-edit-credential"
                    : "admin-credential"
                }
                onChange={(next) => {
                  setDraft(next)
                  setDraftErrors({})
                  setFormError(null)
                }}
              />

              {formError ? (
                <Field data-invalid>
                  <FieldError>{formError}</FieldError>
                </Field>
              ) : null}
            </FieldGroup>
          </div>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="ghost"
              disabled={formPending}
              onClick={resetDialog}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={formPending}>
              {formPending ? <Spinner data-icon="inline-start" /> : null}
              {dialog === "edit" ? "Save changes" : "Create credential"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )

  const deleteDialog = (
    <Dialog
      open={dialog === "delete"}
      onOpenChange={(open) => {
        if (!open && !deleteCredential.isPending) resetDialog()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete credential?</DialogTitle>
          <DialogDescription>
            This permanently removes the saved profile and cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {selected ? (
          <>
            <Alert variant="destructive">
              <Trash2 />
              <AlertTitle>{selected.name}</AlertTitle>
              <AlertDescription>
                {credentialSummary(selected)} · secret version{" "}
                {selected.secret_version}
              </AlertDescription>
            </Alert>

            {selectedBoundCount !== null && selectedBoundCount > 0 ? (
              <Alert>
                <CircleAlert />
                <AlertTitle>Still bound</AlertTitle>
                <AlertDescription>
                  This profile is used by {selectedBoundCount} machine
                  {selectedBoundCount === 1 ? "" : "s"}. Unbind or replace every
                  binding before deleting it.
                </AlertDescription>
              </Alert>
            ) : null}

            {selectedBoundCount === null && canManageBindings ? (
              <Alert>
                {machinesQuery.isPending ? <Spinner /> : <CircleAlert />}
                <AlertTitle>Binding status unavailable</AlertTitle>
                <AlertDescription>
                  The delete is still available. The API will reject it with a
                  conflict if this credential is bound.
                </AlertDescription>
              </Alert>
            ) : null}

            {deleteError ? (
              <Field data-invalid>
                <FieldError>{deleteError}</FieldError>
              </Field>
            ) : null}
          </>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={deleteCredential.isPending}
            onClick={resetDialog}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={
              deleteCredential.isPending ||
              !selected ||
              (selectedBoundCount ?? 0) > 0
            }
            onClick={() => void handleDelete()}
          >
            {deleteCredential.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : null}
            Delete credential
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  const sortedMachines = (machinesQuery.data ?? []).toSorted((left, right) =>
    machineName(left).localeCompare(machineName(right))
  )
  const confirmingMachine = sortedMachines.find(
    (machine) => machine.mac === confirmingMac
  )
  const confirmingUnbind = confirmingMachine?.credential_id === selected?.id
  const confirmingCurrent = credentials.find(
    (credential) => credential.id === confirmingMachine?.credential_id
  )
  const bindingsDialog = (
    <Dialog
      open={dialog === "bindings" && canManageBindings}
      onOpenChange={(open) => {
        if (!open && !bindingPending) resetDialog()
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {selected ? `${selected.name} bindings` : "Credential bindings"}
          </DialogTitle>
          <DialogDescription>
            Bind, replace, or remove this profile one machine at a time. These
            changes take effect without an SNMP test.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[62vh] flex-col gap-3 overflow-y-auto px-1">
          {bindingError ? (
            <Field data-invalid>
              <FieldError>{bindingError}</FieldError>
            </Field>
          ) : null}

          {confirmingMachine && selected ? (
            <Alert variant={confirmingUnbind ? "destructive" : "default"}>
              {confirmingUnbind ? <Unplug /> : <KeyRound />}
              <AlertTitle>
                {confirmingUnbind
                  ? `Unbind ${machineName(confirmingMachine)}?`
                  : confirmingMachine.credential_id
                    ? `Replace the credential on ${machineName(confirmingMachine)}?`
                    : `Bind ${selected.name} to ${machineName(confirmingMachine)}?`}
              </AlertTitle>
              <AlertDescription>
                {confirmingUnbind
                  ? "The machine stays registered but collection stops until another credential is bound."
                  : `${confirmingCurrent ? `${confirmingCurrent.name} will be replaced by ` : "The machine will use "}${selected.name}. This change is not followed by an SNMP walk test.`}
              </AlertDescription>
            </Alert>
          ) : machinesQuery.isPending ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Spinner />
              Loading machines
            </div>
          ) : machinesQuery.isError ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>Machines could not be loaded</AlertTitle>
              <AlertDescription>
                {errorMessage(
                  machinesQuery.error,
                  "Binding discovery failed. Try again later."
                )}
              </AlertDescription>
            </Alert>
          ) : sortedMachines.length === 0 ? (
            <Alert>
              <KeyRound />
              <AlertTitle>No registered machines</AlertTitle>
              <AlertDescription>
                Register a machine before binding this credential.
              </AlertDescription>
            </Alert>
          ) : selected ? (
            <div className="flex flex-col">
              {sortedMachines.map((machine, index) => (
                <React.Fragment key={machine.mac}>
                  {index > 0 ? <Separator /> : null}
                  <MachineBindingRow
                    machine={machine}
                    credentials={credentials}
                    selected={selected}
                    pending={bindingPending}
                    active={bindingMac === machine.mac}
                    onChange={() => {
                      setBindingError(null)
                      setConfirmingMac(machine.mac)
                    }}
                  />
                </React.Fragment>
              ))}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          {confirmingMachine ? (
            <>
              <Button
                type="button"
                variant="ghost"
                disabled={bindingPending}
                onClick={() => setConfirmingMac(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant={confirmingUnbind ? "destructive" : "default"}
                disabled={bindingPending}
                onClick={() => void handleBinding(confirmingMachine)}
              >
                {bindingPending ? (
                  <Spinner data-icon="inline-start" />
                ) : confirmingUnbind ? (
                  <Unplug data-icon="inline-start" />
                ) : (
                  <KeyRound data-icon="inline-start" />
                )}
                {confirmingUnbind
                  ? "Unbind credential"
                  : confirmingMachine.credential_id
                    ? "Replace credential"
                    : "Bind credential"}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={bindingPending}
              onClick={resetDialog}
            >
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>SNMP credentials</CardTitle>
          <CardDescription>
            Saved, write-only profiles shared by the machines that use them.
          </CardDescription>
          <CardAction>
            {canWrite ? (
              <Button type="button" variant="outline" onClick={openCreate}>
                <Plus data-icon="inline-start" />
                New credential
              </Button>
            ) : (
              <Badge variant="outline">Read only</Badge>
            )}
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col">
          {!canRead ? (
            <Alert>
              <Lock />
              <AlertTitle>Credential list unavailable</AlertTitle>
              <AlertDescription>
                Reading saved profile metadata requires the{" "}
                <code>credentials:read</code> scope.
              </AlertDescription>
            </Alert>
          ) : credentialsQuery.isPending ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Spinner />
              Loading credentials
            </div>
          ) : credentialsQuery.isError ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>Credentials could not be loaded</AlertTitle>
              <AlertDescription>
                {errorMessage(
                  credentialsQuery.error,
                  "Credential loading failed. Try again later."
                )}
              </AlertDescription>
            </Alert>
          ) : credentials.length === 0 ? (
            <Alert>
              <KeyRound />
              <AlertTitle>No saved credentials</AlertTitle>
              <AlertDescription>
                {canWrite
                  ? "Create a profile to reuse the same SNMP settings across machines."
                  : "No SNMP credential profiles are available."}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="flex flex-col">
              {credentials.map((credential, index) => (
                <React.Fragment key={credential.id}>
                  {index > 0 ? <Separator /> : null}
                  <CredentialRow
                    credential={credential}
                    boundCount={
                      canManageBindings
                        ? countBindings(credential.id, machinesQuery.data)
                        : null
                    }
                    bindingsLoading={
                      canManageBindings && machinesQuery.isPending
                    }
                    bindingsFailed={canManageBindings && machinesQuery.isError}
                    canWrite={canWrite}
                    canManageBindings={canManageBindings}
                    onEdit={() => openEdit(credential)}
                    onDelete={() => openDelete(credential)}
                    onBindings={() => openBindings(credential)}
                  />
                </React.Fragment>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {canWrite ? formDialog : null}
      {canWrite ? deleteDialog : null}
      {canManageBindings ? bindingsDialog : null}
    </>
  )
}

function CredentialRow({
  credential,
  boundCount,
  bindingsLoading,
  bindingsFailed,
  canWrite,
  canManageBindings,
  onEdit,
  onDelete,
  onBindings,
}: {
  credential: SnmpCredential
  boundCount: number | null
  bindingsLoading: boolean
  bindingsFailed: boolean
  canWrite: boolean
  canManageBindings: boolean
  onEdit: () => void
  onDelete: () => void
  onBindings: () => void
}) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{credential.name}</span>
          <Badge variant="outline">secret v{credential.secret_version}</Badge>
          {canManageBindings ? (
            boundCount !== null ? (
              <Badge variant="secondary">{boundCount} bound</Badge>
            ) : bindingsLoading ? (
              <Badge variant="outline">
                <Spinner data-icon="inline-start" />
                Checking bindings
              </Badge>
            ) : bindingsFailed ? (
              <Badge variant="destructive">Bindings unavailable</Badge>
            ) : null
          ) : null}
        </div>
        {credential.description ? (
          <p className="text-sm text-muted-foreground">
            {credential.description}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {credentialSummary(credential)}
        </p>
        <p className="min-w-0 text-xs text-muted-foreground">
          Fingerprint{" "}
          <code className="break-all text-foreground">
            {credential.fingerprint}
          </code>
        </p>
      </div>

      {canWrite ? (
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {canManageBindings ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onBindings}
            >
              <KeyRound data-icon="inline-start" />
              Bindings
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" onClick={onEdit}>
            <Pencil data-icon="inline-start" />
            Edit
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 data-icon="inline-start" />
            Delete
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function MachineBindingRow({
  machine,
  credentials,
  selected,
  pending,
  active,
  onChange,
}: {
  machine: Machine
  credentials: SnmpCredential[]
  selected: SnmpCredential
  pending: boolean
  active: boolean
  onChange: () => void
}) {
  const usesSelected = machine.credential_id === selected.id
  const current = credentials.find(
    (credential) => credential.id === machine.credential_id
  )
  const currentLabel = !machine.credential_id
    ? "Unbound"
    : usesSelected
      ? `Current: ${selected.name}`
      : current
        ? `Current: ${current.name}`
        : "Current: another profile"

  return (
    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate font-medium">{machineName(machine)}</span>
        <span className="text-xs text-muted-foreground">
          {machine.ipv4} · <span className="font-mono">{machine.mac}</span>
        </span>
      </div>
      <Badge variant={usesSelected ? "secondary" : "outline"}>
        {currentLabel}
      </Badge>
      <Button
        type="button"
        size="sm"
        variant={usesSelected ? "destructive" : "outline"}
        disabled={pending}
        onClick={onChange}
      >
        {active && pending ? (
          <Spinner data-icon="inline-start" />
        ) : usesSelected ? (
          <Unplug data-icon="inline-start" />
        ) : (
          <KeyRound data-icon="inline-start" />
        )}
        {usesSelected ? "Unbind" : machine.credential_id ? "Replace" : "Bind"}
      </Button>
    </div>
  )
}
