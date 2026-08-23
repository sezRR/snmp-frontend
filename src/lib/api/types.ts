import { z } from "zod"

export const tokenPairSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.string().default("bearer"),
  expires_in: z.number().int(),
})
export type TokenPair = z.infer<typeof tokenPairSchema>

export const meSchema = z.object({
  id: z.string(),
  username: z.string(),
  is_active: z.boolean(),
  roles: z.array(z.string()),
  scopes: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
})
export type Me = z.infer<typeof meSchema>

export const streamTicketSchema = z.object({
  ticket: z.string(),
  expires_in: z.number(),
})
export type StreamTicket = z.infer<typeof streamTicketSchema>

export const loginSchema = z.object({
  username: z.string().min(1, "Enter your username"),
  password: z.string().min(1, "Enter your password"),
})
export type LoginBody = z.infer<typeof loginSchema>

export const passwordChangeSchema = z
  .object({
    current_password: z.string().min(1, "Enter your current password"),
    new_password: z.string().min(1, "Enter a new password"),
    confirm_password: z.string().min(1, "Repeat the new password"),
  })
  .refine((value) => value.new_password === value.confirm_password, {
    path: ["confirm_password"],
    message: "The two passwords do not match",
  })
export type PasswordChangeForm = z.infer<typeof passwordChangeSchema>

const identityTimestampSchema = z.iso.datetime({ offset: true })

export const roleOutSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  is_system: z.boolean(),
  scopes: z.array(z.string()),
  created_at: identityTimestampSchema,
  updated_at: identityTimestampSchema,
})
export type RoleOut = z.infer<typeof roleOutSchema>

export const roleCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  scopes: z.array(z.string()).optional(),
})
export type RoleCreate = z.infer<typeof roleCreateSchema>

export const roleUpdateSchema = z.object({
  description: z.string().max(500).nullable().optional(),
})
export type RoleUpdate = z.infer<typeof roleUpdateSchema>

export const scopeInfoSchema = z.object({
  name: z.string(),
  description: z.string(),
})
export type ScopeInfo = z.infer<typeof scopeInfoSchema>

export const userOutSchema = z.object({
  id: z.uuid(),
  username: z.string(),
  is_active: z.boolean(),
  roles: z.array(z.string()),
  scopes: z.array(z.string()),
  created_at: identityTimestampSchema,
  updated_at: identityTimestampSchema,
})
export type UserOut = z.infer<typeof userOutSchema>

export const userCreateSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1),
  roles: z.array(z.string()).optional(),
})
export type UserCreate = z.infer<typeof userCreateSchema>

export const userUpdateSchema = z.object({
  is_active: z.boolean().nullable().optional(),
})
export type UserUpdate = z.infer<typeof userUpdateSchema>

export const replaceRoleScopesSchema = z.object({
  scopes: z.array(z.string()),
})
export type ReplaceRoleScopes = z.infer<typeof replaceRoleScopesSchema>

export const replaceUserRolesSchema = z.object({
  roles: z.array(z.string()),
})
export type ReplaceUserRoles = z.infer<typeof replaceUserRolesSchema>

export const resetUserPasswordSchema = z.object({
  new_password: z.string().min(1),
})
export type ResetUserPassword = z.infer<typeof resetUserPasswordSchema>

export const flavorInfoSchema = z.object({
  name: z.string(),
  vcpus: z.number().int(),
  ram_mb: z.number().int(),
  disk_gb: z.number().int(),
})
export type FlavorInfo = z.infer<typeof flavorInfoSchema>

export const serverInfoSchema = z.object({
  server_id: z.string(),
  name: z.string(),
  tenant_name: z.string(),
  user_name: z.string(),
  status: z.string(),
  mac: z.string(),
  ipv4: z.string(),
  subnet_name: z.string().nullish(),
  flavor: flavorInfoSchema,
})
export type ServerInfo = z.infer<typeof serverInfoSchema>

export const machineSchema = z.object({
  mac: z.string(),
  ipv4: z.string(),
  label: z.string().nullable(),
  enabled: z.boolean(),
  external: z.boolean().default(false),
  credential_id: z.string().nullish(),
  created_at: z.string(),
  updated_at: z.string(),
  openstack: serverInfoSchema.nullish(),
  openstack_found: z.boolean(),
})
export type Machine = z.infer<typeof machineSchema>

export const macSchema = z
  .string()
  .trim()
  .regex(
    /^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i,
    "Enter a MAC like fa:16:3e:00:00:01"
  )
  .transform((value) => value.toLowerCase().replaceAll("-", ":"))

export const machineCreateSchema = z.object({
  ipv4: z.ipv4("Enter a valid IPv4 address"),
  mac: macSchema.optional(),
  label: z.string().max(200).optional(),
})
export type MachineCreate = z.infer<typeof machineCreateSchema>

export const machineUpdateSchema = z.object({
  label: z.string().max(200).nullish(),
  enabled: z.boolean().nullish(),
  ipv4: z.ipv4("Enter a valid IPv4 address").optional(),
})
export type MachineUpdate = z.infer<typeof machineUpdateSchema>

export const SNMP_VERSIONS = ["2c", "3"] as const
export const snmpVersionSchema = z.enum(SNMP_VERSIONS)
export type SnmpVersion = z.infer<typeof snmpVersionSchema>

export const SECURITY_LEVELS = [
  "noAuthNoPriv",
  "authNoPriv",
  "authPriv",
] as const
export const securityLevelSchema = z.enum(SECURITY_LEVELS)
export type SecurityLevel = z.infer<typeof securityLevelSchema>

export const AUTH_PROTOCOLS = [
  "MD5",
  "SHA",
  "SHA224",
  "SHA256",
  "SHA384",
  "SHA512",
] as const
export const authProtocolSchema = z.enum(AUTH_PROTOCOLS)
export type AuthProtocol = z.infer<typeof authProtocolSchema>

export const PRIV_PROTOCOLS = [
  "DES",
  "3DES",
  "AES128",
  "AES192",
  "AES256",
] as const
export const privProtocolSchema = z.enum(PRIV_PROTOCOLS)
export type PrivProtocol = z.infer<typeof privProtocolSchema>

export const WEAK_AUTH_PROTOCOLS: readonly string[] = ["MD5"]
export const WEAK_PRIV_PROTOCOLS: readonly string[] = ["DES"]

export const snmpCredentialSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  snmp_version: snmpVersionSchema,
  username: z.string().nullish(),
  security_level: securityLevelSchema.nullish(),
  auth_protocol: authProtocolSchema.nullish(),
  priv_protocol: privProtocolSchema.nullish(),
  secret_version: z.number().int(),
  fingerprint: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type SnmpCredential = z.infer<typeof snmpCredentialSchema>

const passphraseSchema = z
  .string()
  .min(8, "Passphrases are at least 8 characters")
  .max(200)

export const snmpCredentialFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name the credential").max(200),
    description: z.string().max(1000).optional(),
    snmp_version: snmpVersionSchema,
    community: z.string().min(1, "Enter the community string").optional(),
    username: z.string().max(200).optional(),
    security_level: securityLevelSchema.optional(),
    auth_protocol: authProtocolSchema.optional(),
    auth_passphrase: passphraseSchema.optional(),
    priv_protocol: privProtocolSchema.optional(),
    priv_passphrase: passphraseSchema.optional(),
    allow_weak: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    const require = (
      field: keyof typeof value,
      present: unknown,
      message: string
    ) => {
      if (present === undefined || present === null || present === "") {
        ctx.addIssue({ code: "custom", path: [field], message })
      }
    }

    if (value.snmp_version === "2c") {
      require("community", value.community, "Enter the community string")
      return
    }

    require("username", value.username, "Enter the SNMPv3 username")
    const level = value.security_level
    if (level === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["security_level"],
        message: "Pick a security level",
      })
      return
    }

    if (level === "noAuthNoPriv" && !value.allow_weak) {
      ctx.addIssue({
        code: "custom",
        path: ["security_level"],
        message:
          "noAuthNoPriv sends the exchange in clear. Allow weak settings to use it.",
      })
    }

    if (level === "authNoPriv" || level === "authPriv") {
      require("auth_protocol", value.auth_protocol, "Pick an auth protocol")
      require("auth_passphrase", value.auth_passphrase, "Enter the auth passphrase")
      if (
        value.auth_protocol &&
        WEAK_AUTH_PROTOCOLS.includes(value.auth_protocol) &&
        !value.allow_weak
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["auth_protocol"],
          message: `${value.auth_protocol} is broken. Allow weak settings to use it.`,
        })
      }
    }

    if (level === "authPriv") {
      require("priv_protocol", value.priv_protocol, "Pick a privacy protocol")
      require("priv_passphrase", value.priv_passphrase, "Enter the privacy passphrase")
      if (
        value.priv_protocol &&
        WEAK_PRIV_PROTOCOLS.includes(value.priv_protocol) &&
        !value.allow_weak
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["priv_protocol"],
          message: `${value.priv_protocol} is broken. Allow weak settings to use it.`,
        })
      }
    }
  })
export type SnmpCredentialForm = z.infer<typeof snmpCredentialFormSchema>

export const credentialTestResultSchema = z.object({
  ok: z.boolean(),
  ipv4: z.string(),
  credential_id: z.string().nullish(),
  duration_seconds: z.number(),
  detail: z.string().nullish(),
})
export type CredentialTestResult = z.infer<typeof credentialTestResultSchema>

const optionalNumber = z.number().nullish()

export const cpuMetricsSchema = z.looseObject({
  cores: optionalNumber,
  usage_percent: optionalNumber,
})

export const ramMetricsSchema = z.looseObject({
  used_bytes: optionalNumber,
  total_bytes: optionalNumber,
  used_percent: optionalNumber,
})

export const diskIoMetricsSchema = z.looseObject({
  read_bps: optionalNumber,
  write_bps: optionalNumber,
  read_iops: optionalNumber,
  write_iops: optionalNumber,
  read_bytes: optionalNumber,
  write_bytes: optionalNumber,
  read_ops: optionalNumber,
  write_ops: optionalNumber,
  interval_seconds: optionalNumber,
})

export const diskMetricsSchema = z.looseObject({
  mount: z.string().nullish(),
  device: z.string().nullish(),
  used_bytes: optionalNumber,
  total_bytes: optionalNumber,
  used_percent: optionalNumber,
  read_bps: optionalNumber,
  write_bps: optionalNumber,
  read_iops: optionalNumber,
  write_iops: optionalNumber,
  io: diskIoMetricsSchema.nullish(),
})

export const netInterfaceMetricsSchema = z.looseObject({
  name: z.string().nullish(),
  rx_bps: optionalNumber,
  tx_bps: optionalNumber,
  rx_bytes: optionalNumber,
  tx_bytes: optionalNumber,
  speed_bps: optionalNumber,
  rx_util_percent: optionalNumber,
  tx_util_percent: optionalNumber,
})

export const netMetricsSchema = z.looseObject({
  rx_bps: optionalNumber,
  tx_bps: optionalNumber,
  rx_bytes: optionalNumber,
  tx_bytes: optionalNumber,
  interval_seconds: optionalNumber,
  interfaces: z.array(netInterfaceMetricsSchema).nullish(),
})

export const metricsPayloadSchema = z.looseObject({
  cpu: cpuMetricsSchema.nullish(),
  ram: ramMetricsSchema.nullish(),
  disk: z.array(diskMetricsSchema).nullish(),
  disk_io: diskIoMetricsSchema.nullish(),
  diskio: diskIoMetricsSchema.nullish(),
  network: netMetricsSchema.nullish(),
  net: netMetricsSchema.nullish(),
})
export type MetricsPayload = z.infer<typeof metricsPayloadSchema>

export const metricSampleSchema = z.object({
  ts: z.string(),
  mac: z.string(),
  metrics: metricsPayloadSchema,
})
export type MetricSample = z.infer<typeof metricSampleSchema>

export const metricStatsRowSchema = z.object({
  bucket: z.string(),
  mac: z.string(),
  samples: z.number().int(),
  cpu_usage_percent_avg: optionalNumber,
  cpu_usage_percent_max: optionalNumber,
  ram_used_percent_avg: optionalNumber,
  ram_used_percent_max: optionalNumber,
  disk_used_percent_avg: optionalNumber,
  disk_used_percent_max: optionalNumber,
  disk_read_bps_avg: optionalNumber,
  disk_read_bps_max: optionalNumber,
  disk_write_bps_avg: optionalNumber,
  disk_write_bps_max: optionalNumber,
  disk_read_iops_avg: optionalNumber,
  disk_read_iops_max: optionalNumber,
  disk_write_iops_avg: optionalNumber,
  disk_write_iops_max: optionalNumber,
  net_rx_bps_avg: optionalNumber,
  net_rx_bps_max: optionalNumber,
  net_tx_bps_avg: optionalNumber,
  net_tx_bps_max: optionalNumber,
})
export type MetricStatsRow = z.infer<typeof metricStatsRowSchema>

export const metricSourceCountSchema = z.object({
  rows: z.number().int().nonnegative(),
  samples: z.number().int().nonnegative(),
  oldest: z.string().nullable(),
  latest: z.string().nullable(),
})
export type MetricSourceCount = z.infer<typeof metricSourceCountSchema>

export const metricCountSchema = z.object({
  mac: z.string(),
  samples: z.number().int().nonnegative(),
  latest: z.string().nullable(),
  metrics: metricSourceCountSchema,
  metrics_1m: metricSourceCountSchema,
  metrics_1h: metricSourceCountSchema,
})
export type MetricCount = z.infer<typeof metricCountSchema>

export const purgeResultSchema = z.object({
  scope: z.string(),
  mac: z.string().nullish(),
  before: z.string().nullish(),
  method: z.string(),
  rows_deleted: z.number().int().nullish(),
  rows_deleted_by_source: z
    .object({
      metrics: z.number().int().nonnegative(),
      metrics_1m: z.number().int().nonnegative(),
      metrics_1h: z.number().int().nonnegative(),
    })
    .nullish(),
})
export type PurgeResult = z.infer<typeof purgeResultSchema>

export const cacheStatsSchema = z.object({
  ttl_seconds: z.number(),
  populated: z.boolean(),
  fetched_at: z.string().nullish(),
  age_seconds: z.number().nullish(),
  servers: z.number().int().default(0),
  hits: z.number().int().default(0),
  misses: z.number().int().default(0),
  refreshes: z.number().int().default(0),
  last_error: z.string().nullish(),
})
export type CacheStats = z.infer<typeof cacheStatsSchema>

export const cacheFlushedSchema = z.object({
  flushed: z.boolean().default(true),
  dropped_servers: z.number().int(),
})
export type CacheFlushed = z.infer<typeof cacheFlushedSchema>

export const collectorMachineStatSchema = z.looseObject({
  mac: z.string().nullish(),
  ipv4: z.string().nullish(),
  ok_count: optionalNumber,
  fail_count: optionalNumber,
  success: optionalNumber,
  failure: optionalNumber,
  successes: optionalNumber,
  failures: optionalNumber,
  last_error: z.string().nullish(),
  last_ok: z.string().nullish(),
  last_error_at: z.string().nullish(),
  last_success_at: z.string().nullish(),
  // Failures in a row, and how long until the next attempt. A machine that
  // keeps failing is retried on a doubling delay rather than every round, so
  // "0 ok / 9 failed" alone reads as a stalled collector when it is working.
  consecutive_failures: optionalNumber,
  retry_in_seconds: optionalNumber,
})
export type CollectorMachineStat = z.infer<typeof collectorMachineStatSchema>

export const collectorStatusSchema = z.looseObject({
  enabled: z.boolean().nullish(),
  running: z.boolean().nullish(),
  interval_seconds: optionalNumber,
  effective_interval_seconds: optionalNumber,
  overrun_count: optionalNumber,
  tick_count: optionalNumber,
  ticks: optionalNumber,
  last_tick_at: z.string().nullish(),
  last_tick_duration_seconds: optionalNumber,
  last_inserted: optionalNumber,
  last_failed: optionalNumber,
  // Machines inside their backoff window, which were not polled at all.
  last_skipped: optionalNumber,
  last_tick_error: z.string().nullish(),
  last_error: z.string().nullish(),
  machines: z
    .union([
      z.array(collectorMachineStatSchema),
      z.record(z.string(), collectorMachineStatSchema),
    ])
    .nullish(),
})
export type CollectorStatus = z.infer<typeof collectorStatusSchema>

export const forceTickResultSchema = z.looseObject({
  stored: optionalNumber,
  failed: optionalNumber,
  polled: optionalNumber,
  succeeded: optionalNumber,
  duration_seconds: optionalNumber,
})
export type ForceTickResult = z.infer<typeof forceTickResultSchema>
