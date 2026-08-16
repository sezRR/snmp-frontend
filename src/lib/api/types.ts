import { z } from "zod"

// Mirrors the FastAPI OpenAPI document (SNMP metrics API 0.7.0). OpenStack is
// the source of truth for machine facts when it knows the address, so a
// machine's hardware limits come from the OpenStack flavor — but a machine
// absent from the cache is still a machine, and everything here treats those
// facts as optional.

// --- Auth -----------------------------------------------------------------

export const tokenPairSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.string().default("bearer"),
  /** Access token lifetime in seconds; the refresh token outlives it. */
  expires_in: z.number().int(),
})
export type TokenPair = z.infer<typeof tokenPairSchema>

/**
 * `/auth/me`. The backend reads this from the database rather than from the
 * presented token, so `scopes` is current even when the token predates a role
 * change — which is what makes it safe to drive the UI's permissions from.
 */
export const meSchema = z.object({
  id: z.string(),
  username: z.string(),
  is_active: z.boolean(),
  roles: z.array(z.string()),
  /** Union of the scopes this user's roles hold. */
  scopes: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
})
export type Me = z.infer<typeof meSchema>

export const streamTicketSchema = z.object({
  ticket: z.string(),
  /** Seconds before the ticket is useless. Single-use regardless. */
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
  flavor: flavorInfoSchema,
})
export type ServerInfo = z.infer<typeof serverInfoSchema>

export const machineSchema = z.object({
  mac: z.string(),
  ipv4: z.string(),
  label: z.string().nullable(),
  enabled: z.boolean(),
  /**
   * Registered with a client-supplied MAC because OpenStack has no record of
   * the address. Such a machine never carries server facts and the collector
   * leaves its address alone — which is what makes `ipv4` patchable here and
   * nowhere else. Defaulted so a backend older than 0.6.2 still parses.
   */
  external: z.boolean().default(false),
  /**
   * The SNMP profile the collector authenticates with. Null means the machine
   * is registered but not polled — there is nothing to poll it with — which is
   * why registration offers to bind one straight away.
   */
  credential_id: z.string().nullish(),
  created_at: z.string(),
  updated_at: z.string(),
  // Null when OpenStack no longer knows the MAC — reported, never faked.
  openstack: serverInfoSchema.nullish(),
  openstack_found: z.boolean(),
})
export type Machine = z.infer<typeof machineSchema>

/** Colon- or hyphen-separated, normalized to the lowercase colon form. */
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
  /**
   * Required only outside the OpenStack fleet: with no record to resolve, the
   * client is the only thing that can name the machine. Sending one for an
   * address OpenStack does know is allowed but has to agree with the fleet.
   */
  mac: macSchema.optional(),
  label: z.string().max(200).optional(),
})
export type MachineCreate = z.infer<typeof machineCreateSchema>

export const machineUpdateSchema = z.object({
  label: z.string().max(200).nullish(),
  enabled: z.boolean().nullish(),
  /**
   * External machines only. OpenStack owns a managed machine's address and the
   * collector re-reads it every tick, so a patch there lasts one interval.
   */
  ipv4: z.ipv4("Enter a valid IPv4 address").optional(),
})
export type MachineUpdate = z.infer<typeof machineUpdateSchema>

// --- SNMP credentials -----------------------------------------------------
// A profile is created once and bound to as many machines as share it. The
// secret is write-only: the backend encrypts it on the way in and never reads
// it back, so everything below describes a credential without carrying one.

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

/**
 * Choices the backend refuses outright unless `allow_weak` is set. MD5 and DES
 * are broken rather than merely dated, and noAuthNoPriv sends the whole
 * exchange in clear — so each is a deliberate opt-in, never a default.
 */
export const WEAK_AUTH_PROTOCOLS: readonly string[] = ["MD5"]
export const WEAK_PRIV_PROTOCOLS: readonly string[] = ["DES"]

/** A credential as the API returns it. There is no secret field here. */
export const snmpCredentialSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  snmp_version: snmpVersionSchema,
  username: z.string().nullish(),
  security_level: securityLevelSchema.nullish(),
  auth_protocol: authProtocolSchema.nullish(),
  priv_protocol: privProtocolSchema.nullish(),
  /** Bumped whenever the secret is replaced, so a rotation is visible. */
  secret_version: z.number().int(),
  /** Of the secret, so two profiles can be told apart without reading either. */
  fingerprint: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type SnmpCredential = z.infer<typeof snmpCredentialSchema>

const passphraseSchema = z
  .string()
  .min(8, "Passphrases are at least 8 characters")
  .max(200)

/**
 * The USM shape, validated the way the backend validates it.
 *
 * Half a v3 credential is not repairable — authPriv without a priv passphrase
 * is a row no validator could fix — so the fields are checked together rather
 * than one at a time, and the message names the field that is missing.
 */
export const snmpCredentialFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name the credential").max(200),
    description: z.string().max(1000).optional(),
    snmp_version: snmpVersionSchema,
    /** v2c only. */
    community: z.string().min(1, "Enter the community string").optional(),
    /** v3 only: the USM securityName. */
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
      require(
        "auth_passphrase",
        value.auth_passphrase,
        "Enter the auth passphrase"
      )
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
      require(
        "priv_passphrase",
        value.priv_passphrase,
        "Enter the privacy passphrase"
      )
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
  /** True when the backend answered from its fault injector, not from SNMP. */
  simulated: z.boolean().default(false),
})
export type CredentialTestResult = z.infer<typeof credentialTestResultSchema>

// --- Metric samples -------------------------------------------------------
// `metrics` is jsonb on the backend and deliberately untyped there, so every
// field is optional and unknown keys are preserved rather than stripped.

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

/** Throughput and operation rates, reported per mount and/or as a total. */
export const diskIoMetricsSchema = z.looseObject({
  read_bps: optionalNumber,
  write_bps: optionalNumber,
  read_iops: optionalNumber,
  write_iops: optionalNumber,
  /** Absolute counters, when the agent exposes them alongside the rates. */
  read_bytes: optionalNumber,
  write_bytes: optionalNumber,
  read_ops: optionalNumber,
  write_ops: optionalNumber,
  /** Window the rates were derived over. */
  interval_seconds: optionalNumber,
})

export const diskMetricsSchema = z.looseObject({
  mount: z.string().nullish(),
  device: z.string().nullish(),
  used_bytes: optionalNumber,
  total_bytes: optionalNumber,
  used_percent: optionalNumber,
  // The IO rates are read both from the mount entry itself and from a nested
  // `io` object, since either placement is a payload the collector may emit.
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
  /** Link speed, which is what turns bps into a utilization percentage. */
  speed_bps: optionalNumber,
  rx_util_percent: optionalNumber,
  tx_util_percent: optionalNumber,
})

export const netMetricsSchema = z.looseObject({
  rx_bps: optionalNumber,
  tx_bps: optionalNumber,
  rx_bytes: optionalNumber,
  tx_bytes: optionalNumber,
  /** Window the rates were derived over. */
  interval_seconds: optionalNumber,
  interfaces: z.array(netInterfaceMetricsSchema).nullish(),
})

export const metricsPayloadSchema = z.looseObject({
  cpu: cpuMetricsSchema.nullish(),
  ram: ramMetricsSchema.nullish(),
  disk: z.array(diskMetricsSchema).nullish(),
  // Fleet-wide disk IO, when the collector totals it instead of (or as well
  // as) reporting per mount. `diskio` is accepted as an alias.
  disk_io: diskIoMetricsSchema.nullish(),
  diskio: diskIoMetricsSchema.nullish(),
  // The collector emits `network`; `net` is accepted as an alias so a payload
  // from either naming still renders.
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

// /metrics/counts is `additionalProperties: true`; only the two fields the UI
// needs are named, and both are read defensively.
export const metricCountSchema = z.looseObject({
  mac: z.string(),
  samples: optionalNumber,
  rows: optionalNumber,
  count: optionalNumber,
  latest: z.string().nullish(),
  latest_ts: z.string().nullish(),
})
export type MetricCount = z.infer<typeof metricCountSchema>

export const purgeResultSchema = z.object({
  scope: z.string(),
  mac: z.string().nullish(),
  before: z.string().nullish(),
  method: z.string(),
  rows_deleted: z.number().int().nullish(),
})
export type PurgeResult = z.infer<typeof purgeResultSchema>

// --- Admin ----------------------------------------------------------------

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

// The collector status body is untyped on the backend. Everything the UI reads
// is optional so a payload change degrades the panel instead of breaking it,
// and the counters are named twice over: `ok_count`/`fail_count` is what the
// collector emits, the rest are aliases kept for older builds of it.
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
  /** When each outcome last happened — which of the two is newer is what
   *  says whether the machine is failing now or merely has failed before. */
  last_ok: z.string().nullish(),
  last_error_at: z.string().nullish(),
  last_success_at: z.string().nullish(),
})
export type CollectorMachineStat = z.infer<typeof collectorMachineStatSchema>

export const collectorStatusSchema = z.looseObject({
  enabled: z.boolean().nullish(),
  running: z.boolean().nullish(),
  interval_seconds: optionalNumber,
  /** The cadence the loop actually achieved, interval plus its own drift. */
  effective_interval_seconds: optionalNumber,
  overrun_count: optionalNumber,
  tick_count: optionalNumber,
  ticks: optionalNumber,
  last_tick_at: z.string().nullish(),
  last_tick_duration_seconds: optionalNumber,
  /** Machines that produced a sample, and that failed, in the last round. */
  last_inserted: optionalNumber,
  last_failed: optionalNumber,
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
