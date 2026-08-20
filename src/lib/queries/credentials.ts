import { api } from "@/lib/api/client"
import {
  type CredentialTestResult,
  type SnmpCredential,
  type SnmpCredentialForm,
  credentialTestResultSchema,
  snmpCredentialSchema,
} from "@/lib/api/types"
import { useHasScope } from "@/lib/auth/rbac"
import { SCOPES } from "@/lib/auth/scopes"
import { machinesQueryKey } from "@/lib/queries/machines"
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { z } from "zod"

const credentialListSchema = z.array(snmpCredentialSchema)

export const credentialsQueryKey = ["snmp-credentials"] as const

export const credentialsQueryOptions = () =>
  queryOptions({
    queryKey: credentialsQueryKey,
    queryFn: () =>
      api.get("/snmp-credentials", { schema: credentialListSchema }),
    staleTime: 60_000,
  })

/**
 * The saved profiles. Reading them is `credentials:read`, which a machines-only
 * role does not hold — polling it anyway would beat on a 403, so the query is
 * gated and the UI treats "not allowed" as "no profiles to pick from".
 */
export function useCredentialsQuery({ enabled = true } = {}) {
  const allowed = useHasScope(SCOPES.credentialsRead)
  return useQuery({ ...credentialsQueryOptions(), enabled: enabled && allowed })
}

function useInvalidateCredentials() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: credentialsQueryKey }),
      // A bind writes `credential_id` onto the machine, so the machine list is
      // stale the moment either end of the relationship moves.
      queryClient.invalidateQueries({ queryKey: machinesQueryKey }),
    ])
}

/**
 * The secret goes up once and is never readable again, so the form is sent
 * whole: empty strings are dropped rather than sent as blanks the backend
 * would have to interpret.
 */
function credentialBody(form: SnmpCredentialForm): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: form.name,
    snmp_version: form.snmp_version,
    allow_weak: form.allow_weak,
  }
  const optional = {
    description: form.description,
    community: form.community,
    username: form.username,
    security_level: form.security_level,
    auth_protocol: form.auth_protocol,
    auth_passphrase: form.auth_passphrase,
    priv_protocol: form.priv_protocol,
    priv_passphrase: form.priv_passphrase,
  }
  for (const [key, value] of Object.entries(optional)) {
    if (value !== undefined && value !== "") body[key] = value
  }
  return body
}

function credentialTestBody(form: SnmpCredentialForm): Record<string, unknown> {
  const body = credentialBody(form)
  delete body.name
  delete body.description
  return body
}

export function useCreateCredentialMutation() {
  const invalidate = useInvalidateCredentials()
  return useMutation({
    mutationFn: (form: SnmpCredentialForm) =>
      api.post("/snmp-credentials", {
        body: credentialBody(form),
        schema: snmpCredentialSchema,
      }),
    onSuccess: invalidate,
  })
}

/**
 * Metadata can be patched alone. A patch that touches any SNMP/USM field has
 * to carry the whole credential shape, which the caller validates first.
 */
export function useUpdateCredentialMutation() {
  const invalidate = useInvalidateCredentials()
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<SnmpCredentialForm>
    }) =>
      api.patch(`/snmp-credentials/${encodeURIComponent(id)}`, {
        body: patch,
        schema: snmpCredentialSchema,
      }),
    onSuccess: invalidate,
  })
}

export function useDeleteCredentialMutation() {
  const invalidate = useInvalidateCredentials()
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<void>(`/snmp-credentials/${encodeURIComponent(id)}`),
    onSuccess: invalidate,
  })
}

export function useBindCredentialMutation() {
  const invalidate = useInvalidateCredentials()
  return useMutation({
    mutationFn: ({
      mac,
      credentialId,
    }: {
      mac: string
      credentialId: string
    }) =>
      api.put<unknown>(`/machines/${encodeURIComponent(mac)}/snmp-credential`, {
        body: { credential_id: credentialId },
      }),
    onSuccess: invalidate,
  })
}

export function useUnbindCredentialMutation() {
  const invalidate = useInvalidateCredentials()
  return useMutation({
    mutationFn: (mac: string) =>
      api.delete<void>(`/machines/${encodeURIComponent(mac)}/snmp-credential`),
    onSuccess: invalidate,
  })
}

/**
 * Poll one machine once, to check a credential works.
 *
 * The address is the machine's own — the endpoint takes no address, and must
 * not, since a stored credential aimed at an arbitrary host is the relay attack
 * the whole design exists to prevent. An unsaved credential in the body is
 * fine: the caller typed the secret, so it tells them nothing new.
 */
export function useTestCredentialMutation() {
  return useMutation({
    mutationFn: ({
      mac,
      credential,
    }: {
      mac: string
      credential?: SnmpCredentialForm
    }): Promise<CredentialTestResult> =>
      api.post(`/machines/${encodeURIComponent(mac)}/snmp-credential/test`, {
        body: credential
          ? { credential: credentialTestBody(credential) }
          : { credential: null },
        schema: credentialTestResultSchema,
      }),
  })
}

/** "SNMPv3 · authPriv · SHA256/AES128" — enough to tell two profiles apart. */
export function credentialSummary(credential: SnmpCredential): string {
  if (credential.snmp_version === "2c") return "SNMPv2c · community"
  const parts = ["SNMPv3", credential.security_level ?? "unknown level"]
  const protocols = [credential.auth_protocol, credential.priv_protocol].filter(
    (value) => value !== null && value !== undefined
  )
  if (protocols.length > 0) parts.push(protocols.join("/"))
  if (credential.username) parts.push(credential.username)
  return parts.join(" · ")
}
