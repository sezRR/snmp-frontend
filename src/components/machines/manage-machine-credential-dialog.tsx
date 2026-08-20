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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/client"
import type {
  CredentialTestResult,
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
  useTestCredentialMutation,
  useUnbindCredentialMutation,
  useUpdateCredentialMutation,
} from "@/lib/queries/credentials"
import { machineName, machinesQueryOptions } from "@/lib/queries/machines"
import { cn } from "@/lib/utils"
import { useQuery } from "@tanstack/react-query"
import {
  Check,
  CheckCircle2,
  CircleAlert,
  KeyRound,
  Pencil,
  Plus,
  Trash2,
  Unplug,
} from "lucide-react"
import * as React from "react"
import { toast } from "sonner"

type Screen = "manage" | "create" | "edit" | "delete" | "unbind"

interface TestFeedback {
  ok: boolean
  title: string
  detail: string
}

interface ManageMachineCredentialDialogProps {
  machine: Machine
  open: boolean
  onOpenChange: (open: boolean) => void
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

function testFeedback(result: CredentialTestResult): TestFeedback {
  const duration = `${result.duration_seconds.toFixed(result.duration_seconds < 1 ? 2 : 1)}s`
  return {
    ok: result.ok,
    title: result.ok ? "SNMP walk succeeded" : "SNMP walk failed",
    detail: `${result.detail ?? (result.ok ? "The credential works." : "The machine did not answer.")} Completed in ${duration}${result.simulated ? " (simulated)." : "."}`,
  }
}

export function ManageMachineCredentialDialog({
  machine,
  open,
  onOpenChange,
}: ManageMachineCredentialDialogProps) {
  const [screen, setScreen] = React.useState<Screen>("manage")
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [draft, setDraft] =
    React.useState<CredentialDraft>(emptyCredentialDraft)
  const [draftErrors, setDraftErrors] = React.useState<CredentialErrors>({})
  const [feedback, setFeedback] = React.useState<TestFeedback | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const canReadCredentials = useHasScope(SCOPES.credentialsRead)
  const { data: credentials } = useCredentialsQuery({ enabled: open })
  const { data: machines, isFetching: machinesFetching } = useQuery({
    ...machinesQueryOptions(),
    enabled: open,
  })

  const bind = useBindCredentialMutation()
  const unbind = useUnbindCredentialMutation()
  const create = useCreateCredentialMutation()
  const update = useUpdateCredentialMutation()
  const remove = useDeleteCredentialMutation()
  const test = useTestCredentialMutation()

  const profiles = credentials ?? []
  const currentId = machine.credential_id ?? null
  const current = profiles.find((profile) => profile.id === currentId)
  const selected =
    profiles.find((profile) => profile.id === selectedId) ??
    current ??
    profiles[0]
  const boundMachines = selected
    ? (machines ?? [machine]).filter(
        (entry) => entry.credential_id === selected.id
      )
    : []
  const usageKnown = machines !== undefined && !machinesFetching
  const busy =
    bind.isPending ||
    unbind.isPending ||
    create.isPending ||
    update.isPending ||
    remove.isPending ||
    test.isPending

  const reset = () => {
    setScreen("manage")
    setSelectedId(null)
    setDraft(emptyCredentialDraft)
    setDraftErrors({})
    setFeedback(null)
    setError(null)
  }

  const changeScreen = (next: Screen) => {
    setScreen(next)
    setFeedback(null)
    setError(null)
  }

  const runBoundTest = async () => {
    setFeedback(null)
    setError(null)
    try {
      const result = await test.mutateAsync({ mac: machine.mac })
      setFeedback(testFeedback(result))
      return result
    } catch (problem) {
      setFeedback({
        ok: false,
        title: "Credential test failed",
        detail: errorMessage(problem, "The test request failed"),
      })
      return null
    }
  }

  /**
   * Bind, then prove it: a profile that binds but cannot walk the machine
   * leaves it registered and unpolled, so a failed check puts the previous
   * binding back rather than leaving the machine worse off than it started.
   */
  const bindProfile = async (profile: SnmpCredential) => {
    const previousCredentialId = currentId
    setFeedback(null)
    setError(null)
    try {
      await bind.mutateAsync({
        mac: machine.mac,
        credentialId: profile.id,
      })
    } catch (problem) {
      setError(errorMessage(problem, "Credential would not bind"))
      return
    }

    const result = await runBoundTest()
    if (result?.ok) {
      toast.success(`Bound ${profile.name} to ${machineName(machine)}`)
      return
    }

    try {
      if (previousCredentialId) {
        await bind.mutateAsync({
          mac: machine.mac,
          credentialId: previousCredentialId,
        })
        toast.error(`${profile.name} failed; restored the previous profile`)
      } else {
        await unbind.mutateAsync(machine.mac)
        toast.error(`${profile.name} failed and was left unbound`)
      }
    } catch (problem) {
      setError(
        errorMessage(problem, "The failed binding could not be rolled back")
      )
    }
  }

  const handleBind = async () => {
    if (!selected || selected.id === currentId) return
    await bindProfile(selected)
  }

  const handleUnbind = async () => {
    try {
      await unbind.mutateAsync(machine.mac)
      toast.success(`Unbound the credential from ${machineName(machine)}`)
      changeScreen("manage")
    } catch (problem) {
      setError(errorMessage(problem, "Credential would not unbind"))
    }
  }

  const beginEdit = () => {
    if (!selected) return
    setDraft(credentialDraftFrom(selected))
    setDraftErrors({})
    changeScreen("edit")
  }

  const beginCreate = () => {
    setDraft(emptyCredentialDraft)
    setDraftErrors({})
    changeScreen("create")
  }

  const validDraft = (): SnmpCredentialForm | null => {
    const parsed = parseCredentialDraft(draft)
    setDraftErrors(parsed.errors)
    if (!parsed.data) setError("Fix the highlighted fields")
    return parsed.data
  }

  const metadataPatch = (): Partial<SnmpCredentialForm> | null => {
    const parsed = parseCredentialMetadataDraft(draft)
    setDraftErrors(parsed.errors)
    if (!parsed.data) {
      setError("Fix the highlighted fields")
      return null
    }
    return parsed.data
  }

  const handleTestDraft = async () => {
    const credential = validDraft()
    if (!credential) return

    setError(null)
    setFeedback(null)
    try {
      const result = await test.mutateAsync({
        mac: machine.mac,
        credential,
      })
      setFeedback(testFeedback(result))
    } catch (problem) {
      setFeedback({
        ok: false,
        title: "Credential test failed",
        detail: errorMessage(problem, "The test request failed"),
      })
    }
  }

  /**
   * The profile is saved before it is bound, so a secret that turns out not to
   * walk this machine is still on the list to be corrected rather than typed
   * again. Binding then goes through the same test-and-roll-back path as any
   * other profile.
   */
  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    const credential = validDraft()
    if (!credential) return

    setError(null)
    let created: SnmpCredential
    try {
      created = await create.mutateAsync(credential)
    } catch (problem) {
      setError(errorMessage(problem, "Credential could not be saved"))
      return
    }

    toast.success(`Saved ${created.name}`)
    setSelectedId(created.id)
    setDraft(emptyCredentialDraft)
    setDraftErrors({})
    setScreen("manage")
    await bindProfile(created)
  }

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selected) return
    const shapeChanged = credentialShapeChanged(draft, selected)
    const patch = shapeChanged ? validDraft() : metadataPatch()
    if (!patch) return

    setError(null)
    try {
      const updated = await update.mutateAsync({
        id: selected.id,
        patch: shapeChanged
          ? { ...patch, description: draft.description }
          : patch,
      })
      toast.success(`Updated ${updated.name}`)
      changeScreen("manage")
    } catch (problem) {
      setError(errorMessage(problem, "Credential update failed"))
    }
  }

  const handleDelete = async () => {
    if (!selected || !usageKnown || boundMachines.length > 0) return
    try {
      await remove.mutateAsync(selected.id)
      toast.success(`Deleted ${selected.name}`)
      setSelectedId(null)
      changeScreen("manage")
    } catch (problem) {
      setError(errorMessage(problem, "Credential deletion failed"))
    }
  }

  const title =
    screen === "edit"
      ? `Edit ${selected?.name ?? "credential"}`
      : screen === "create"
        ? "New SNMP credential"
        : screen === "delete"
          ? "Delete credential?"
          : screen === "unbind"
            ? "Unbind credential?"
            : "Manage SNMP credential"

  const description =
    screen === "edit"
      ? "Name and description can change alone. To change SNMP settings or rotate a secret, enter the complete credential again."
      : screen === "create"
        ? `Saved as a profile, then bound to ${machineName(machine)} and checked with one walk. A failed walk leaves the previous binding in place.`
        : screen === "delete"
          ? "This removes the saved profile permanently. It cannot be undone."
          : screen === "unbind"
            ? `${machineName(machine)} stays registered but is not polled until another profile is bound.`
            : `Test or change the profile used to poll ${machineName(machine)} at ${machine.ipv4}.`

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {screen === "manage" ? (
          <>
            <div className="max-h-[58vh] overflow-y-auto px-1">
              <FieldGroup>
                <Field>
                  <FieldLabel>Current binding</FieldLabel>
                  <Alert>
                    <KeyRound />
                    <AlertTitle>
                      {current?.name ??
                        (currentId ? "Saved credential" : "No credential")}
                    </AlertTitle>
                    <AlertDescription>
                      {current
                        ? credentialSummary(current)
                        : currentId
                          ? "Profile metadata is not available with your current permissions."
                          : "The collector skips this machine until a profile is bound."}
                    </AlertDescription>
                  </Alert>
                  {currentId ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void runBoundTest()}
                      >
                        {test.isPending ? (
                          <Spinner data-icon="inline-start" />
                        ) : null}
                        Test machine walk
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => changeScreen("unbind")}
                      >
                        <Unplug data-icon="inline-start" />
                        Unbind
                      </Button>
                    </div>
                  ) : null}
                </Field>

                {feedback ? <TestResult feedback={feedback} /> : null}

                <Field>
                  <FieldLabel>
                    Saved profiles
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      className="ml-auto"
                      disabled={busy}
                      onClick={beginCreate}
                    >
                      <Plus data-icon="inline-start" />
                      New profile
                    </Button>
                  </FieldLabel>
                  {profiles.length > 0 ? (
                    <div className="flex max-h-52 flex-col gap-1.5 overflow-y-auto">
                      {profiles.map((profile) => (
                        <ProfileOption
                          key={profile.id}
                          profile={profile}
                          selected={selected?.id === profile.id}
                          current={currentId === profile.id}
                          boundCount={
                            (machines ?? [machine]).filter(
                              (entry) => entry.credential_id === profile.id
                            ).length
                          }
                          disabled={busy}
                          onSelect={() => {
                            setSelectedId(profile.id)
                            setFeedback(null)
                            setError(null)
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {canReadCredentials
                        ? "No saved profiles yet. Create one with the button above."
                        : "Credential metadata requires credentials:read permission. A new profile can still be created and bound here."}
                    </p>
                  )}
                  {selected ? (
                    <FieldDescription>
                      {!usageKnown
                        ? "Checking where this profile is bound."
                        : boundMachines.length > 0
                          ? `Bound to ${boundMachines.length} machine${boundMachines.length === 1 ? "" : "s"}. Unbind or replace every binding before deleting it.`
                          : "Not bound to any registered machine, so it can be deleted."}
                    </FieldDescription>
                  ) : null}
                </Field>

                {error ? <FieldError>{error}</FieldError> : null}
              </FieldGroup>
            </div>

            {selected ? (
              <DialogFooter className="sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={beginEdit}
                  >
                    <Pencil data-icon="inline-start" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy || !usageKnown || boundMachines.length > 0}
                    onClick={() => changeScreen("delete")}
                  >
                    <Trash2 data-icon="inline-start" />
                    Delete
                  </Button>
                </div>
                <Button
                  type="button"
                  disabled={busy || selected.id === currentId}
                  onClick={() => void handleBind()}
                >
                  {bind.isPending ? <Spinner data-icon="inline-start" /> : null}
                  {selected.id === currentId
                    ? "Currently bound"
                    : "Bind and test"}
                </Button>
              </DialogFooter>
            ) : null}
          </>
        ) : null}

        {screen === "create" ? (
          <form onSubmit={(event) => void handleCreate(event)}>
            <div className="max-h-[58vh] overflow-y-auto px-1">
              <FieldGroup>
                <SnmpCredentialFields
                  draft={draft}
                  onChange={(next) => {
                    setDraft(next)
                    setFeedback(null)
                    setError(null)
                  }}
                  errors={draftErrors}
                  disabled={busy}
                  idPrefix="new-machine-credential"
                />
                {feedback ? <TestResult feedback={feedback} /> : null}
                {error ? <FieldError>{error}</FieldError> : null}
              </FieldGroup>
            </div>
            <DialogFooter className="mt-4 sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => changeScreen("manage")}
              >
                Back
              </Button>
              <div className="flex flex-wrap gap-2">
                {/* Tested against this machine without saving anything, so a
                    typo costs a walk rather than a profile to clean up. */}
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void handleTestDraft()}
                >
                  {test.isPending ? <Spinner data-icon="inline-start" /> : null}
                  Test walk
                </Button>
                <Button type="submit" disabled={busy}>
                  {create.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : null}
                  Create and bind
                </Button>
              </div>
            </DialogFooter>
          </form>
        ) : null}

        {screen === "edit" && selected ? (
          <form onSubmit={(event) => void handleUpdate(event)}>
            <div className="max-h-[58vh] overflow-y-auto px-1">
              <FieldGroup>
                {boundMachines.length > 0 ? (
                  <Alert>
                    <CircleAlert />
                    <AlertTitle>Shared profile</AlertTitle>
                    <AlertDescription>
                      Saving replaces the credential used by{" "}
                      {boundMachines.length} machine
                      {boundMachines.length === 1 ? "" : "s"} on the next
                      collection round. Testing only checks {machine.ipv4}.
                    </AlertDescription>
                  </Alert>
                ) : null}
                <SnmpCredentialFields
                  draft={draft}
                  onChange={(next) => {
                    setDraft(next)
                    setFeedback(null)
                    setError(null)
                  }}
                  errors={draftErrors}
                  disabled={busy}
                  idPrefix="edit-credential"
                />
                {feedback ? <TestResult feedback={feedback} /> : null}
                {error ? <FieldError>{error}</FieldError> : null}
              </FieldGroup>
            </div>
            <DialogFooter className="mt-4 sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => changeScreen("manage")}
              >
                Back
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void handleTestDraft()}
                >
                  {test.isPending ? <Spinner data-icon="inline-start" /> : null}
                  Test changes
                </Button>
                <Button type="submit" disabled={busy}>
                  {update.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : null}
                  Save changes
                </Button>
              </div>
            </DialogFooter>
          </form>
        ) : null}

        {screen === "unbind" ? (
          <>
            {error ? <FieldError>{error}</FieldError> : null}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => changeScreen("manage")}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={() => void handleUnbind()}
              >
                {unbind.isPending ? <Spinner data-icon="inline-start" /> : null}
                Unbind credential
              </Button>
            </DialogFooter>
          </>
        ) : null}

        {screen === "delete" && selected ? (
          <>
            <Alert variant="destructive">
              <Trash2 />
              <AlertTitle>{selected.name}</AlertTitle>
              <AlertDescription>
                {credentialSummary(selected)} will be removed from the saved
                profile list.
              </AlertDescription>
            </Alert>
            {error ? <FieldError>{error}</FieldError> : null}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => changeScreen("manage")}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={busy || !usageKnown || boundMachines.length > 0}
                onClick={() => void handleDelete()}
              >
                {remove.isPending ? <Spinner data-icon="inline-start" /> : null}
                Delete profile
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function ProfileOption({
  profile,
  selected,
  current,
  boundCount,
  disabled,
  onSelect,
}: {
  profile: SnmpCredential
  selected: boolean
  current: boolean
  boundCount: number
  disabled: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-2 rounded-lg border p-2.5 text-left text-sm outline-none transition-colors hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
        selected && "border-primary/40 bg-primary/5"
      )}
    >
      <KeyRound className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{profile.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {credentialSummary(profile)}
        </span>
      </span>
      {current ? <Badge variant="secondary">current</Badge> : null}
      {boundCount > 0 ? (
        <Badge variant="outline">{boundCount} bound</Badge>
      ) : null}
      {selected ? <Check className="size-4 shrink-0 text-primary" /> : null}
    </button>
  )
}

function TestResult({ feedback }: { feedback: TestFeedback }) {
  return (
    <Alert variant={feedback.ok ? "success" : "destructive"}>
      {feedback.ok ? <CheckCircle2 /> : <CircleAlert />}
      <AlertTitle>{feedback.title}</AlertTitle>
      <AlertDescription>{feedback.detail}</AlertDescription>
    </Alert>
  )
}
