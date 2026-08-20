import {
  type CredentialDraft,
  type CredentialErrors,
  SnmpCredentialFields,
  emptyCredentialDraft,
  parseCredentialDraft,
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
import { ApiError } from "@/lib/api/client"
import type {
  Machine,
  MachineCreate,
  ServerInfo,
  SnmpCredential,
  SnmpCredentialForm,
} from "@/lib/api/types"
import { machineCreateSchema } from "@/lib/api/types"
import { useHasScope } from "@/lib/auth/rbac"
import { SCOPES } from "@/lib/auth/scopes"
import { useCachedServersQuery } from "@/lib/queries/admin"
import {
  credentialSummary,
  useBindCredentialMutation,
  useCreateCredentialMutation,
  useCredentialsQuery,
  useTestCredentialMutation,
  useUnbindCredentialMutation,
} from "@/lib/queries/credentials"
import {
  machineName,
  machinesQueryOptions,
  useRegisterAllMachinesMutation,
} from "@/lib/queries/machines"
import { cn } from "@/lib/utils"
import { type View, addMachinesToView } from "@/lib/views"
import { useQuery } from "@tanstack/react-query"
import { Check, CircleAlert, KeyRound, Plus } from "lucide-react"
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

type Step = "target" | "credential" | "review"

/**
 * Fixed for the life of the dialog. The credential step has nothing to ask
 * when nothing is being registered, but dropping it from the list made the
 * wizard grow a step the moment an address was typed, which reads as the run
 * getting longer rather than as a step becoming relevant.
 */
const STEPS: Step[] = ["target", "credential", "review"]

const STEP_LABELS: Record<Step, string> = {
  target: "Machines",
  credential: "Credential",
  review: "Review",
}

/**
 * How the machines being registered get something to be polled with. Offering
 * the choice here avoids leaving a successfully registered machine silently
 * skipped by the collector until someone notices it has no credential.
 */
type CredentialMode = "existing" | "new"

interface RegistrationOutcome {
  title: string
  details: string[]
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

/**
 * Registration in three steps: what to poll, what to poll it with, and a look
 * at both before anything is written.
 *
 * It was one long card, which put an SNMPv3 USM identity — a username, a
 * security level and two passphrases — directly below an address field, with
 * nothing saying the second half was optional or which fields the first half
 * made irrelevant. Splitting it lets each step ask one question and validate
 * its own answer before the next one is worth filling in.
 */
export function AddMachineDialog({ view }: AddMachineDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [stepIndex, setStepIndex] = React.useState(0)

  const [picked, setPicked] = React.useState<string[]>([])
  const [attached, setAttached] = React.useState<string[]>([])
  const [ipv4, setIpv4] = React.useState("")
  const [mac, setMac] = React.useState("")
  const [label, setLabel] = React.useState("")

  const [credentialMode, setCredentialMode] =
    React.useState<CredentialMode>("existing")
  const [credentialId, setCredentialId] = React.useState<string | null>(null)
  const [draft, setDraft] =
    React.useState<CredentialDraft>(emptyCredentialDraft)
  const [draftErrors, setDraftErrors] = React.useState<CredentialErrors>({})

  const [error, setError] = React.useState<string | null>(null)
  const [outcome, setOutcome] = React.useState<RegistrationOutcome | null>(null)

  const canRegister = useHasScope(SCOPES.machinesWrite)
  // Binding is `credentials:write` whichever profile is bound — repointing a
  // machine at a shared secret is the privileged half, not creating one.
  const canBind = useHasScope(SCOPES.credentialsWrite)
  const canListCredentials = useHasScope(SCOPES.credentialsRead)

  const register = useRegisterAllMachinesMutation()
  const createCredential = useCreateCredentialMutation()
  const bind = useBindCredentialMutation()
  const unbind = useUnbindCredentialMutation()
  const testCredential = useTestCredentialMutation()
  const [submitting, setSubmitting] = React.useState(false)

  // The picker is a convenience the OpenStack cache provides, and reading it
  // is an admin scope — without it, registration still works by typing an
  // address, which is the path every external machine takes anyway.
  const { data: servers } = useCachedServersQuery({ enabled: open })
  const { data: machines } = useQuery(machinesQueryOptions())
  const { data: credentials } = useCredentialsQuery({ enabled: open })

  const registered = new Set(machines?.map((machine) => machine.mac))
  const available = (servers ?? []).filter(
    (server) => !registered.has(server.mac)
  )
  // Inside a view, a machine that is already registered but not a member is
  // added to the view rather than registered again.
  const joinable = view
    ? (machines ?? []).filter((machine) => !view.macs.includes(machine.mac))
    : []

  const typedAddress = ipv4.trim()
  // The cache is exactly what the backend resolves a MAC from, so an address
  // missing here is the address that has to be named by hand.
  const cached = (servers ?? []).find((entry) => entry.ipv4 === typedAddress)
  const macRequired = Boolean(typedAddress) && servers !== undefined && !cached

  const registerCount = picked.length + (typedAddress ? 1 : 0)
  // Nothing to poll means nothing to authenticate with: attaching machines a
  // view already knows about never reaches the backend.
  const needsCredentialStep = canRegister && canBind && registerCount > 0

  const index = Math.min(stepIndex, STEPS.length - 1)
  const step = STEPS[index]

  // A saved profile is only an option when there is one to read: without
  // `credentials:read` the list is empty for a reason the user cannot fix from
  // here, so the mode falls through to creating one rather than offering a
  // picker with nothing in it.
  const savedProfiles = credentials ?? []
  const canPickExisting = canListCredentials && savedProfiles.length > 0
  const mode: CredentialMode =
    credentialMode === "existing" && !canPickExisting ? "new" : credentialMode

  const selected = savedProfiles.find((entry) => entry.id === credentialId)

  const reset = () => {
    setStepIndex(0)
    setPicked([])
    setAttached([])
    setIpv4("")
    setMac("")
    setLabel("")
    setCredentialMode("existing")
    setCredentialId(null)
    setDraft(emptyCredentialDraft)
    setDraftErrors({})
    setError(null)
    setOutcome(null)
    register.reset()
    createCredential.reset()
    bind.reset()
    unbind.reset()
    testCredential.reset()
  }

  /**
   * The registration bodies the target step describes, or the reason it does
   * not describe any yet. Recomputed rather than stored, so a correction on
   * the way back through the wizard is picked up without a second validation
   * path to keep in step.
   */
  const buildBodies = (): { bodies: MachineCreate[]; error: string | null } => {
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
        return {
          bodies,
          error: parsed.error.issues[0]?.message ?? "Enter a valid address",
        }
      }
      if (macRequired && !parsed.data.mac) {
        return {
          bodies,
          error: `OpenStack has no record of ${typedAddress}. Enter its MAC to register it as an external machine.`,
        }
      }
      // The fleet names its own machines: sending a MAC that disagrees with
      // the lookup is a 422, and catching it here says which one is wrong.
      if (
        cached &&
        parsed.data.mac &&
        parsed.data.mac !== cached.mac.toLowerCase().replaceAll("-", ":")
      ) {
        return {
          bodies,
          error: `OpenStack knows ${typedAddress} as ${cached.mac}. Clear the MAC or correct it.`,
        }
      }
      bodies.push(parsed.data)
    }

    if (bodies.length === 0 && attached.length === 0) {
      return {
        bodies,
        error: view
          ? "Pick a machine to add, or enter an address"
          : "Pick a server or enter an address",
      }
    }

    return { bodies, error: null }
  }

  /** Whether the current step is answered well enough to leave it. */
  const validateStep = (): boolean => {
    if (step === "target") {
      const { error: problem } = buildBodies()
      setError(problem)
      return problem === null
    }

    if (step === "credential") {
      // The step is always shown, so it is always walked through; with nothing
      // to register there is nothing to validate and no answer to demand.
      if (!needsCredentialStep) {
        setError(null)
        return true
      }
      if (mode === "existing" && !credentialId) {
        setError("Pick a saved profile, or create one")
        return false
      }
      if (mode === "new") {
        const { data, errors } = parseCredentialDraft(draft)
        setDraftErrors(errors)
        if (!data) {
          setError("Fix the highlighted fields")
          return false
        }
      }
      setError(null)
      return true
    }

    return true
  }

  const goNext = () => {
    if (!validateStep()) return
    setError(null)
    setStepIndex(index + 1)
  }

  const goBack = () => {
    setError(null)
    setStepIndex(Math.max(0, index - 1))
  }

  const handleSubmit = async () => {
    const { bodies, error: problem } = buildBodies()
    if (problem) {
      setError(problem)
      setStepIndex(0)
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      let inlineCredential: SnmpCredentialForm | null = null
      let savedCredentialId: string | null = null
      if (needsCredentialStep) {
        if (mode === "existing") {
          if (!credentialId) {
            setError("Pick a saved profile, or create one")
            setStepIndex(STEPS.indexOf("credential"))
            return
          }
          savedCredentialId = credentialId
        } else {
          const { data } = parseCredentialDraft(draft)
          if (!data) {
            setError("Fix the highlighted fields")
            setStepIndex(STEPS.indexOf("credential"))
            return
          }
          inlineCredential = data
        }
      }

      const { registered: created, failed } =
        bodies.length > 0
          ? await register.mutateAsync(bodies)
          : { registered: [], failed: [] }

      const details = failed.map(
        (failure) => `${failure.ipv4}: ${failure.reason}`
      )
      const tested: Machine[] = []
      const testFailures: { machine: Machine; reason: string }[] = []

      // A new secret is tested inline before it is saved or bound. The machine
      // row already exists, so the endpoint still gets its destination from
      // registration rather than accepting an attacker-controlled address.
      if (inlineCredential) {
        for (const machine of created) {
          try {
            const result = await testCredential.mutateAsync({
              mac: machine.mac,
              credential: inlineCredential,
            })
            if (result.ok) {
              tested.push(machine)
            } else {
              testFailures.push({
                machine,
                reason: result.detail ?? "The machine did not answer the walk",
              })
            }
          } catch (problem) {
            testFailures.push({
              machine,
              reason: errorMessage(problem, "Credential test failed"),
            })
          }
        }

        // Keep the profile available for correction even when every walk
        // fails, but only bind it to machines on which the inline test passed.
        if (created.length > 0) {
          try {
            savedCredentialId = (
              await createCredential.mutateAsync(inlineCredential)
            ).id
          } catch (problem) {
            details.push(
              `Credential profile was not saved: ${errorMessage(problem, "creation failed")}`
            )
          }
        }
      }

      const bindFailures: { machine: Machine; reason: string }[] = []
      if (savedCredentialId) {
        const candidates = inlineCredential ? tested : created
        for (const machine of candidates) {
          try {
            await bind.mutateAsync({
              mac: machine.mac,
              credentialId: savedCredentialId,
            })
          } catch (problem) {
            bindFailures.push({
              machine,
              reason: errorMessage(problem, "Credential would not bind"),
            })
            continue
          }

          // Saved profiles have no readable secret to send inline. Bind first,
          // test the resulting machine configuration, and undo a failed check.
          if (!inlineCredential) {
            let failureReason: string | null = null
            try {
              const result = await testCredential.mutateAsync({
                mac: machine.mac,
              })
              if (result.ok) {
                tested.push(machine)
              } else {
                failureReason =
                  result.detail ?? "The machine did not answer the walk"
              }
            } catch (problem) {
              failureReason = errorMessage(problem, "Credential test failed")
            }

            if (failureReason) {
              testFailures.push({ machine, reason: failureReason })
              try {
                await unbind.mutateAsync(machine.mac)
              } catch (problem) {
                details.push(
                  `${machineName(machine)}: the failed credential could not be unbound (${errorMessage(problem, "unbind failed")})`
                )
              }
            }
          }
        }
      }

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
      if (view && attached.length > 0) {
        toast.success(
          `Added ${attached.length} machine${attached.length === 1 ? "" : "s"} to ${view.name}`
        )
      }
      for (const failure of failed) {
        toast.error(`${failure.ipv4}: ${failure.reason}`)
      }
      for (const failure of bindFailures) {
        const message = `${machineName(failure.machine)}: ${failure.reason}`
        details.push(message)
        toast.error(message)
      }
      if (tested.length === 1) {
        toast.success(`Credential worked on ${machineName(tested[0])}`)
      } else if (tested.length > 1) {
        toast.success(`Credential worked on ${tested.length} machines`)
      }
      for (const failure of testFailures) {
        const name = machineName(failure.machine)
        details.push(`${name}: ${failure.reason}`)
        toast.error(`Walk failed on ${name}`, {
          description: failure.reason,
        })
      }

      if (details.length === 0) {
        setOpen(false)
        reset()
      } else {
        setOutcome({
          title:
            created.length + attached.length > 0
              ? "Machines added with issues"
              : "Machines could not be added",
          details,
        })
      }
    } catch (problem) {
      setOutcome({
        title: "Registration stopped",
        details: [errorMessage(problem, "Registration failed")],
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Registration needs `machines:write`. Inside a view the dialog still earns
  // its place without it — adding an already-registered machine to a view is
  // local state that never reaches the backend — so only the register half
  // goes away there, and everywhere else the button does.
  if (!canRegister && !view) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && submitting) return
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
            {outcome
              ? outcome.title
              : view
                ? `Add machines to ${view.name}`
                : "Register machines"}
          </DialogTitle>
          <DialogDescription>
            {outcome
              ? "Successful registrations remain in place. Review credential and registration failures below."
              : stepDescription(step, view)}
          </DialogDescription>
        </DialogHeader>

        {outcome ? (
          <>
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>Review these results</AlertTitle>
              <AlertDescription>
                <ul className="flex list-disc flex-col gap-1 pl-4">
                  {outcome.details.map((detail, index) => (
                    <li key={`${index}-${detail}`}>{detail}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button
                onClick={() => {
                  setOpen(false)
                  reset()
                }}
              >
                Close
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <Stepper steps={STEPS} index={index} />

            <div className="max-h-[55vh] overflow-y-auto px-1">
              {step === "target" ? (
                <TargetStep
                  canRegister={canRegister}
                  available={available}
                  picked={picked}
                  onPicked={setPicked}
                  joinable={joinable}
                  attached={attached}
                  onAttached={setAttached}
                  ipv4={ipv4}
                  onIpv4={setIpv4}
                  mac={mac}
                  onMac={setMac}
                  label={label}
                  onLabel={setLabel}
                  macRequired={macRequired}
                  typedAddress={typedAddress}
                  invalid={error !== null}
                />
              ) : null}

              {step === "credential" ? (
                needsCredentialStep ? (
                  <CredentialStep
                    mode={mode}
                    onMode={(next) => {
                      setCredentialMode(next)
                      setError(null)
                    }}
                    canPickExisting={canPickExisting}
                    credentials={savedProfiles}
                    credentialId={credentialId}
                    onCredentialId={setCredentialId}
                    draft={draft}
                    onDraft={setDraft}
                    draftErrors={draftErrors}
                    disabled={submitting}
                  />
                ) : (
                  <IdleCredentialStep
                    reason={
                      registerCount === 0
                        ? attached.length > 0
                          ? "Nothing new is being registered, so the machines joining this view keep whatever credential they already hold."
                          : "No machine is being registered yet. Go back and pick a server or type an address to bind a credential here."
                        : "Binding a credential needs the credentials:write scope. These machines are registered without one and stay unpolled until an admin binds it."
                    }
                  />
                )
              ) : null}

              {step === "review" ? (
                <ReviewStep
                  picked={picked}
                  typedAddress={typedAddress}
                  typedMac={mac.trim()}
                  typedLabel={label.trim()}
                  attached={attached}
                  machines={machines ?? []}
                  view={view}
                  credentialSummaryText={
                    !needsCredentialStep
                      ? null
                      : mode === "existing"
                        ? selected
                          ? `${selected.name} · ${credentialSummary(selected)}`
                          : null
                        : `${draft.name} · new ${draft.snmp_version === "3" ? "SNMPv3" : "SNMPv2c"} profile`
                  }
                />
              ) : null}

              {error ? <FieldError className="mt-4">{error}</FieldError> : null}
            </div>

            <DialogFooter className="mt-2 sm:justify-between">
              <Button
                variant="ghost"
                disabled={index === 0 || submitting}
                onClick={goBack}
              >
                Back
              </Button>
              {step === "review" ? (
                <Button
                  disabled={submitting}
                  onClick={() => void handleSubmit()}
                >
                  {submitting ? <Spinner data-icon="inline-start" /> : null}
                  {registerCount + attached.length > 1
                    ? needsCredentialStep
                      ? "Add machines and test new registrations"
                      : `Add ${registerCount + attached.length} machines`
                    : needsCredentialStep
                      ? "Add and test machine"
                      : "Add machine"}
                </Button>
              ) : (
                <Button onClick={goNext}>Continue</Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function stepDescription(step: Step, view: View | undefined): string {
  if (step === "credential") {
    return "The collector authenticates every poll with this. A machine with nothing bound is registered but never polled."
  }
  if (step === "review") {
    return "Nothing has been written yet. This is what will be."
  }
  return view
    ? "Machines already registered can join this view; anything new is registered first."
    : "Pick as many cached OpenStack servers as you like, or type an address. An address OpenStack does not know is registered as an external machine, identified by the MAC you give it."
}

function Stepper({ steps, index }: { steps: Step[]; index: number }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {steps.map((step, position) => (
        <React.Fragment key={step}>
          {position > 0 ? <span className="h-px flex-1 bg-border" /> : null}
          <span
            className={cn(
              "flex items-center gap-1.5",
              position === index && "font-medium text-foreground"
            )}
          >
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full border text-[0.65rem] tabular-nums",
                position < index &&
                  "border-primary bg-primary text-primary-foreground",
                position === index && "border-primary text-primary"
              )}
            >
              {position < index ? <Check className="size-3" /> : position + 1}
            </span>
            {STEP_LABELS[step]}
          </span>
        </React.Fragment>
      ))}
    </div>
  )
}

// --- Step 1: what to poll ---------------------------------------------------

interface TargetStepProps {
  canRegister: boolean
  available: ServerInfo[]
  picked: string[]
  onPicked: (next: string[]) => void
  joinable: Machine[]
  attached: string[]
  onAttached: (next: string[]) => void
  ipv4: string
  onIpv4: (next: string) => void
  mac: string
  onMac: (next: string) => void
  label: string
  onLabel: (next: string) => void
  macRequired: boolean
  typedAddress: string
  invalid: boolean
}

function TargetStep({
  canRegister,
  available,
  picked,
  onPicked,
  joinable,
  attached,
  onAttached,
  ipv4,
  onIpv4,
  mac,
  onMac,
  label,
  onLabel,
  macRequired,
  typedAddress,
  invalid,
}: TargetStepProps) {
  return (
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
                onClick={() => onPicked(available.map((server) => server.ipv4))}
              >
                Select all {available.length}
              </Button>
              {picked.length > 0 ? (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => onPicked([])}
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
            onValueChange={(next: string[]) => onPicked(next)}
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
            onValueChange={(next: string[]) => onAttached(next)}
          >
            {joinable.map((machine) => (
              <ToggleGroupItem key={machine.mac} value={machine.mac}>
                {machineName(machine)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <FieldDescription>
            Added to this view without touching the backend, so they keep
            whatever credential they already hold.
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
              aria-invalid={invalid && typedAddress ? true : undefined}
              onChange={(event) => onIpv4(event.target.value)}
            />
            <FieldDescription>
              Any reachable address. One OpenStack has no record of is polled
              all the same, as an external machine, with no flavor limits and an
              address only you can change.
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
                invalid && macRequired && !mac.trim() ? true : undefined
              }
              onChange={(event) => onMac(event.target.value)}
            />
            <FieldDescription>
              {macRequired
                ? `OpenStack has no record of ${typedAddress}, so its MAC, the machine's identity here, has to come from you.`
                : "Only needed for addresses outside the OpenStack fleet; the lookup resolves the rest."}
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="machine-label">Label (optional)</FieldLabel>
            <Input
              id="machine-label"
              placeholder="core-worker-01"
              value={label}
              onChange={(event) => onLabel(event.target.value)}
            />
            <FieldDescription>
              Applies to the typed address; picked servers keep their OpenStack
              name.
            </FieldDescription>
          </Field>
        </>
      ) : null}
    </FieldGroup>
  )
}

// --- Step 2: what to poll it with -------------------------------------------

interface CredentialStepProps {
  mode: CredentialMode
  onMode: (next: CredentialMode) => void
  canPickExisting: boolean
  credentials: SnmpCredential[]
  credentialId: string | null
  onCredentialId: (next: string) => void
  draft: CredentialDraft
  onDraft: (next: CredentialDraft) => void
  draftErrors: CredentialErrors
  disabled?: boolean
}

function CredentialStep({
  mode,
  onMode,
  canPickExisting,
  credentials,
  credentialId,
  onCredentialId,
  draft,
  onDraft,
  draftErrors,
  disabled,
}: CredentialStepProps) {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel>SNMP credential</FieldLabel>
        <ToggleGroup
          variant="outline"
          spacing={0}
          value={[mode]}
          disabled={disabled}
          onValueChange={(next: unknown[]) => {
            const chosen = next[0] as CredentialMode | undefined
            if (chosen) onMode(chosen)
          }}
        >
          <ToggleGroupItem value="existing" disabled={!canPickExisting}>
            Saved profile
          </ToggleGroupItem>
          <ToggleGroupItem value="new">New profile</ToggleGroupItem>
        </ToggleGroup>
      </Field>

      {mode === "existing" ? (
        <Field>
          <FieldLabel>Profile</FieldLabel>
          <div className="flex flex-col gap-1.5">
            {credentials.map((credential) => (
              <button
                key={credential.id}
                type="button"
                disabled={disabled}
                onClick={() => onCredentialId(credential.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border p-2.5 text-left text-sm outline-none transition-colors hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50",
                  credentialId === credential.id &&
                    "border-primary/40 bg-primary/5"
                )}
              >
                <KeyRound className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {credential.name}
                </span>
                <Badge variant="outline">SNMPv{credential.snmp_version}</Badge>
                {credentialId === credential.id ? (
                  <Check className="size-4 text-primary" />
                ) : null}
              </button>
            ))}
          </div>
          <FieldDescription>
            Bound as-is. Editing the profile later reaches every machine that
            holds it, on the next collection round.
          </FieldDescription>
        </Field>
      ) : null}

      {mode === "new" ? (
        <SnmpCredentialFields
          draft={draft}
          onChange={onDraft}
          errors={draftErrors}
          disabled={disabled}
          idPrefix="new-credential"
        />
      ) : null}
    </FieldGroup>
  )
}

/**
 * The credential step with nothing to ask: it keeps its place in the wizard so
 * the stepper stays three steps long, and says why it is empty rather than
 * looking like a form that failed to load.
 */
function IdleCredentialStep({ reason }: { reason: string }) {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel>SNMP credential</FieldLabel>
        <p className="text-sm text-muted-foreground">{reason}</p>
      </Field>
    </FieldGroup>
  )
}

// --- Step 3: what is about to happen ----------------------------------------

interface ReviewStepProps {
  picked: string[]
  typedAddress: string
  typedMac: string
  typedLabel: string
  attached: string[]
  machines: { mac: string; label: string | null; ipv4: string }[]
  view?: View
  credentialSummaryText: string | null
}

function ReviewStep({
  picked,
  typedAddress,
  typedMac,
  typedLabel,
  attached,
  machines,
  view,
  credentialSummaryText,
}: ReviewStepProps) {
  const nameOf = (mac: string) => {
    const machine = machines.find((entry) => entry.mac === mac)
    return machine ? (machine.label ?? machine.ipv4) : mac
  }

  return (
    <FieldGroup>
      {picked.length > 0 || typedAddress ? (
        <Field>
          <FieldLabel>Registering</FieldLabel>
          <ul className="flex flex-col gap-1 text-sm">
            {picked.map((address) => (
              <li key={address} className="flex items-center gap-2">
                <span className="font-mono text-xs">{address}</span>
                <Badge variant="outline">OpenStack</Badge>
              </li>
            ))}
            {typedAddress ? (
              <li className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs">{typedAddress}</span>
                {typedMac ? (
                  <Badge variant="outline" className="font-mono">
                    {typedMac}
                  </Badge>
                ) : null}
                {typedLabel ? (
                  <Badge variant="secondary">{typedLabel}</Badge>
                ) : null}
              </li>
            ) : null}
          </ul>
        </Field>
      ) : null}

      {attached.length > 0 && view ? (
        <Field>
          <FieldLabel>Joining {view.name}</FieldLabel>
          <ul className="flex flex-col gap-1 text-sm">
            {attached.map((mac) => (
              <li key={mac}>{nameOf(mac)}</li>
            ))}
          </ul>
          <FieldDescription>
            Already registered, so this only edits the view.
          </FieldDescription>
        </Field>
      ) : null}

      <Field>
        <FieldLabel>Credential</FieldLabel>
        <p className="text-sm">
          {credentialSummaryText ??
            "Not set. These machines stay registered but are not polled until one is bound."}
        </p>
        {credentialSummaryText ? (
          <FieldDescription>
            Each new machine is checked once. New secrets are tested before
            binding; a saved profile is unbound again if its check fails.
          </FieldDescription>
        ) : null}
      </Field>
    </FieldGroup>
  )
}
