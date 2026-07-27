import { z } from "zod"

// Mirrors the FastAPI OpenAPI document (SNMP metrics API 0.6.0). OpenStack is
// the source of truth for machine facts when it knows the address, so a
// machine's hardware limits come from the OpenStack flavor — but a machine
// absent from the cache is still a machine, and everything here treats those
// facts as optional.

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
  created_at: z.string(),
  updated_at: z.string(),
  // Null when OpenStack no longer knows the MAC — reported, never faked.
  openstack: serverInfoSchema.nullish(),
  openstack_found: z.boolean(),
})
export type Machine = z.infer<typeof machineSchema>

export const machineCreateSchema = z.object({
  ipv4: z.ipv4("Enter a valid IPv4 address"),
  label: z.string().max(200).optional(),
})
export type MachineCreate = z.infer<typeof machineCreateSchema>

export const machineUpdateSchema = z.object({
  label: z.string().max(200).nullish(),
  enabled: z.boolean().nullish(),
})
export type MachineUpdate = z.infer<typeof machineUpdateSchema>

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
// is optional so a payload change degrades the panel instead of breaking it.
export const collectorMachineStatSchema = z.looseObject({
  mac: z.string().nullish(),
  success: optionalNumber,
  failure: optionalNumber,
  successes: optionalNumber,
  failures: optionalNumber,
  last_error: z.string().nullish(),
  last_success_at: z.string().nullish(),
})
export type CollectorMachineStat = z.infer<typeof collectorMachineStatSchema>

export const collectorStatusSchema = z.looseObject({
  running: z.boolean().nullish(),
  interval_seconds: optionalNumber,
  ticks: optionalNumber,
  last_tick_at: z.string().nullish(),
  last_tick_duration_seconds: optionalNumber,
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
  polled: optionalNumber,
  succeeded: optionalNumber,
  failed: optionalNumber,
  duration_seconds: optionalNumber,
})
export type ForceTickResult = z.infer<typeof forceTickResultSchema>
