import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  AUTH_PROTOCOLS,
  type AuthProtocol,
  PRIV_PROTOCOLS,
  type PrivProtocol,
  SECURITY_LEVELS,
  type SecurityLevel,
  type SnmpCredentialForm,
  type SnmpVersion,
  WEAK_AUTH_PROTOCOLS,
  WEAK_PRIV_PROTOCOLS,
  snmpCredentialFormSchema,
} from "@/lib/api/types"

/**
 * The form's own state: every field a string, because that is what an input
 * holds. `parseCredentialDraft` is what turns it into the shape the API takes,
 * dropping the fields the chosen version and security level do not use.
 */
export interface CredentialDraft {
  name: string
  snmp_version: SnmpVersion
  community: string
  username: string
  security_level: SecurityLevel
  auth_protocol: AuthProtocol
  auth_passphrase: string
  priv_protocol: PrivProtocol
  priv_passphrase: string
  allow_weak: boolean
}

/**
 * v3 at authPriv with SHA256/AES128 — the strongest pair every agent this
 * polls actually implements, and the one combination that needs no opt-in.
 */
export const emptyCredentialDraft: CredentialDraft = {
  name: "",
  snmp_version: "3",
  community: "",
  username: "",
  security_level: "authPriv",
  auth_protocol: "SHA256",
  auth_passphrase: "",
  priv_protocol: "AES128",
  priv_passphrase: "",
  allow_weak: false,
}

export type CredentialErrors = Partial<Record<keyof CredentialDraft, string>>

export interface ParsedDraft {
  data: SnmpCredentialForm | null
  errors: CredentialErrors
}

/**
 * Validate a draft the way the backend validates the body.
 *
 * The version and the security level decide which fields are even sent: a v2c
 * profile carrying a leftover passphrase from a half-typed v3 one would be
 * rejected, and rightly, so the unused half is dropped here rather than
 * explained to the user.
 */
export function parseCredentialDraft(draft: CredentialDraft): ParsedDraft {
  const v3 = draft.snmp_version === "3"
  const authed =
    v3 &&
    (draft.security_level === "authNoPriv" ||
      draft.security_level === "authPriv")
  const priv = v3 && draft.security_level === "authPriv"

  const result = snmpCredentialFormSchema.safeParse({
    name: draft.name,
    snmp_version: draft.snmp_version,
    community: v3 ? undefined : draft.community || undefined,
    username: v3 ? draft.username || undefined : undefined,
    security_level: v3 ? draft.security_level : undefined,
    auth_protocol: authed ? draft.auth_protocol : undefined,
    auth_passphrase: authed ? draft.auth_passphrase || undefined : undefined,
    priv_protocol: priv ? draft.priv_protocol : undefined,
    priv_passphrase: priv ? draft.priv_passphrase || undefined : undefined,
    allow_weak: draft.allow_weak,
  })

  if (result.success) return { data: result.data, errors: {} }

  const errors: CredentialErrors = {}
  for (const issue of result.error.issues) {
    const field = issue.path[0]
    // First message per field: a list of every way one input is wrong reads
    // as noise next to the input itself.
    if (typeof field === "string" && !(field in errors)) {
      errors[field as keyof CredentialDraft] = issue.message
    }
  }
  return { data: null, errors }
}

/** Whether the draft asks for something the backend refuses without opt-in. */
export function draftIsWeak(draft: CredentialDraft): boolean {
  if (draft.snmp_version !== "3") return false
  if (draft.security_level === "noAuthNoPriv") return true
  const authed =
    draft.security_level === "authNoPriv" ||
    draft.security_level === "authPriv"
  if (authed && WEAK_AUTH_PROTOCOLS.includes(draft.auth_protocol)) return true
  return (
    draft.security_level === "authPriv" &&
    WEAK_PRIV_PROTOCOLS.includes(draft.priv_protocol)
  )
}

const SECURITY_LEVEL_LABELS: Record<SecurityLevel, string> = {
  noAuthNoPriv: "noAuthNoPriv (no auth, no encryption)",
  authNoPriv: "authNoPriv (authenticated, sent in clear)",
  authPriv: "authPriv (authenticated and encrypted)",
}

/** `items` is what the trigger renders the selected value from. */
const protocolItems = (
  protocols: readonly string[],
  weak: readonly string[]
): Record<string, string> =>
  Object.fromEntries(
    protocols.map((protocol) => [
      protocol,
      weak.includes(protocol) ? `${protocol} (weak)` : protocol,
    ])
  )

const AUTH_PROTOCOL_ITEMS = protocolItems(AUTH_PROTOCOLS, WEAK_AUTH_PROTOCOLS)
const PRIV_PROTOCOL_ITEMS = protocolItems(PRIV_PROTOCOLS, WEAK_PRIV_PROTOCOLS)

interface SnmpCredentialFieldsProps {
  draft: CredentialDraft
  onChange: (draft: CredentialDraft) => void
  errors?: CredentialErrors
  disabled?: boolean
  /** Prefix for input ids, so two of these can coexist on one page. */
  idPrefix?: string
}

/**
 * The credential form itself: an SNMP version, then whatever that version
 * needs. v2c is a community string; v3 is a USM identity whose shape the
 * security level decides, which is why the passphrase fields appear and
 * disappear rather than sitting there greyed out.
 */
export function SnmpCredentialFields({
  draft,
  onChange,
  errors = {},
  disabled,
  idPrefix = "credential",
}: SnmpCredentialFieldsProps) {
  const set = <K extends keyof CredentialDraft>(
    key: K,
    value: CredentialDraft[K]
  ) => onChange({ ...draft, [key]: value })

  const v3 = draft.snmp_version === "3"
  const authed =
    v3 &&
    (draft.security_level === "authNoPriv" ||
      draft.security_level === "authPriv")
  const priv = v3 && draft.security_level === "authPriv"
  const weak = draftIsWeak(draft)

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>SNMP version</FieldLabel>
        <ToggleGroup
          variant="outline"
          spacing={0}
          value={[draft.snmp_version]}
          disabled={disabled}
          onValueChange={(next: unknown[]) => {
            const version = next[0] as SnmpVersion | undefined
            if (version) set("snmp_version", version)
          }}
        >
          <ToggleGroupItem value="2c">SNMPv2c</ToggleGroupItem>
          <ToggleGroupItem value="3">SNMPv3</ToggleGroupItem>
        </ToggleGroup>
        <FieldDescription>
          {v3
            ? "A per-user identity with authentication and, at authPriv, encryption of the payload."
            : "A shared community string, sent in clear on every poll. Fine on a trusted management network and nowhere else."}
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel htmlFor={`${idPrefix}-name`}>Profile name</FieldLabel>
        <Input
          id={`${idPrefix}-name`}
          placeholder={v3 ? "fleet-v3-authpriv" : "fleet-v2c"}
          value={draft.name}
          disabled={disabled}
          aria-invalid={errors.name ? true : undefined}
          onChange={(event) => set("name", event.target.value)}
        />
        <FieldDescription>
          Profiles are shared: bind this one to every machine that answers to
          it, and a rotation reaches all of them at once.
        </FieldDescription>
        {errors.name ? <FieldError>{errors.name}</FieldError> : null}
      </Field>

      {v3 ? (
        <>
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-username`}>Username</FieldLabel>
            <Input
              id={`${idPrefix}-username`}
              placeholder="snmpmonitor"
              autoComplete="off"
              value={draft.username}
              disabled={disabled}
              aria-invalid={errors.username ? true : undefined}
              onChange={(event) => set("username", event.target.value)}
            />
            <FieldDescription>
              The USM securityName configured on the agent.
            </FieldDescription>
            {errors.username ? (
              <FieldError>{errors.username}</FieldError>
            ) : null}
          </Field>

          <Field>
            <FieldLabel htmlFor={`${idPrefix}-level`}>
              Security level
            </FieldLabel>
            <Select
              items={SECURITY_LEVEL_LABELS}
              value={draft.security_level}
              disabled={disabled}
              onValueChange={(next) =>
                set("security_level", next as SecurityLevel)
              }
            >
              <SelectTrigger id={`${idPrefix}-level`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {SECURITY_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {SECURITY_LEVEL_LABELS[level]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {errors.security_level ? (
              <FieldError>{errors.security_level}</FieldError>
            ) : null}
          </Field>

          {authed ? (
            <Field>
              <FieldLabel htmlFor={`${idPrefix}-auth-passphrase`}>
                Authentication
              </FieldLabel>
              <div className="flex gap-2">
                <Select
                  items={AUTH_PROTOCOL_ITEMS}
                  value={draft.auth_protocol}
                  disabled={disabled}
                  onValueChange={(next) =>
                    set("auth_protocol", next as AuthProtocol)
                  }
                >
                  <SelectTrigger className="w-32 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {AUTH_PROTOCOLS.map((protocol) => (
                        <SelectItem key={protocol} value={protocol}>
                          {protocol}
                          {WEAK_AUTH_PROTOCOLS.includes(protocol)
                            ? " (weak)"
                            : ""}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Input
                  id={`${idPrefix}-auth-passphrase`}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Auth passphrase"
                  value={draft.auth_passphrase}
                  disabled={disabled}
                  aria-invalid={errors.auth_passphrase ? true : undefined}
                  onChange={(event) =>
                    set("auth_passphrase", event.target.value)
                  }
                />
              </div>
              <FieldDescription>
                At least 8 characters. Encrypted on the backend and never
                readable again, only replaceable.
              </FieldDescription>
              {errors.auth_protocol ?? errors.auth_passphrase ? (
                <FieldError>
                  {errors.auth_protocol ?? errors.auth_passphrase}
                </FieldError>
              ) : null}
            </Field>
          ) : null}

          {priv ? (
            <Field>
              <FieldLabel htmlFor={`${idPrefix}-priv-passphrase`}>
                Privacy
              </FieldLabel>
              <div className="flex gap-2">
                <Select
                  items={PRIV_PROTOCOL_ITEMS}
                  value={draft.priv_protocol}
                  disabled={disabled}
                  onValueChange={(next) =>
                    set("priv_protocol", next as PrivProtocol)
                  }
                >
                  <SelectTrigger className="w-32 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {PRIV_PROTOCOLS.map((protocol) => (
                        <SelectItem key={protocol} value={protocol}>
                          {protocol}
                          {WEAK_PRIV_PROTOCOLS.includes(protocol)
                            ? " (weak)"
                            : ""}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Input
                  id={`${idPrefix}-priv-passphrase`}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Privacy passphrase"
                  value={draft.priv_passphrase}
                  disabled={disabled}
                  aria-invalid={errors.priv_passphrase ? true : undefined}
                  onChange={(event) =>
                    set("priv_passphrase", event.target.value)
                  }
                />
              </div>
              {errors.priv_protocol ?? errors.priv_passphrase ? (
                <FieldError>
                  {errors.priv_protocol ?? errors.priv_passphrase}
                </FieldError>
              ) : null}
            </Field>
          ) : null}

          {/* Only offered once something actually needs it: a checkbox that
              permits MD5 sitting next to SHA256 invites turning it on. */}
          {weak ? (
            <Field orientation="horizontal">
              <Checkbox
                id={`${idPrefix}-allow-weak`}
                checked={draft.allow_weak}
                disabled={disabled}
                onCheckedChange={(checked) =>
                  set("allow_weak", checked === true)
                }
              />
              <FieldContent>
                <FieldLabel htmlFor={`${idPrefix}-allow-weak`}>
                  Allow weak settings
                </FieldLabel>
                <FieldDescription>
                  MD5, DES and noAuthNoPriv are broken rather than dated. The
                  backend refuses them unless this is set.
                </FieldDescription>
              </FieldContent>
            </Field>
          ) : null}
        </>
      ) : (
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-community`}>
            Community string
          </FieldLabel>
          <Input
            id={`${idPrefix}-community`}
            type="password"
            autoComplete="new-password"
            placeholder="public"
            value={draft.community}
            disabled={disabled}
            aria-invalid={errors.community ? true : undefined}
            onChange={(event) => set("community", event.target.value)}
          />
          <FieldDescription>
            Sent unencrypted with every poll. Anything that can see the wire can
            read it, so prefer SNMPv3 wherever the agent supports it.
          </FieldDescription>
          {errors.community ? <FieldError>{errors.community}</FieldError> : null}
        </Field>
      )}
    </FieldGroup>
  )
}
