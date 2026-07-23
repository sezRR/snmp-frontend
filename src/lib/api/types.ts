import { z } from "zod"

export const snmpVersionSchema = z.enum(["v2c", "v3"])
export type SnmpVersion = z.infer<typeof snmpVersionSchema>

export const securityLevelSchema = z.enum([
  "noAuthNoPriv",
  "authNoPriv",
  "authPriv",
])
export type SecurityLevel = z.infer<typeof securityLevelSchema>

export const authProtocolSchema = z.enum([
  "MD5",
  "SHA",
  "SHA224",
  "SHA256",
  "SHA384",
  "SHA512",
])
export type AuthProtocol = z.infer<typeof authProtocolSchema>

export const privProtocolSchema = z.enum(["DES", "AES128", "AES192", "AES256"])
export type PrivProtocol = z.infer<typeof privProtocolSchema>

export const workerStatusSchema = z.enum(["up", "down", "unknown"])
export type WorkerStatus = z.infer<typeof workerStatusSchema>

export const workerSchema = z.object({
  id: z.string(),
  ip: z.string(),
  name: z.string().nullish(),
  snmp_version: snmpVersionSchema,
  status: workerStatusSchema,
  created_at: z.string(),
  last_seen_at: z.string().nullish(),
})
export type Worker = z.infer<typeof workerSchema>

const v2cConfigSchema = z.object({
  community: z.string().min(1),
})

const v3ConfigSchema = z
  .object({
    username: z.string().min(1, "Username is required"),
    security_level: securityLevelSchema,
    auth_protocol: authProtocolSchema.optional(),
    auth_password: z.string().optional(),
    priv_protocol: privProtocolSchema.optional(),
    priv_password: z.string().optional(),
  })
  .superRefine((v3, ctx) => {
    const needsAuth = v3.security_level !== "noAuthNoPriv"
    const needsPriv = v3.security_level === "authPriv"
    if (needsAuth && !v3.auth_protocol) {
      ctx.addIssue({
        code: "custom",
        path: ["auth_protocol"],
        message: "Auth protocol is required",
      })
    }
    if (needsAuth && !v3.auth_password) {
      ctx.addIssue({
        code: "custom",
        path: ["auth_password"],
        message: "Auth password is required",
      })
    }
    if (needsPriv && !v3.priv_protocol) {
      ctx.addIssue({
        code: "custom",
        path: ["priv_protocol"],
        message: "Privacy protocol is required",
      })
    }
    if (needsPriv && !v3.priv_password) {
      ctx.addIssue({
        code: "custom",
        path: ["priv_password"],
        message: "Privacy password is required",
      })
    }
  })

export const workerCreateSchema = z.discriminatedUnion("snmp_version", [
  z.object({
    snmp_version: z.literal("v2c"),
    ip: z.ipv4("Enter a valid IPv4 address"),
    name: z.string().optional(),
    v2c: v2cConfigSchema,
  }),
  z.object({
    snmp_version: z.literal("v3"),
    ip: z.ipv4("Enter a valid IPv4 address"),
    name: z.string().optional(),
    v3: v3ConfigSchema,
  }),
])
export type WorkerCreate = z.infer<typeof workerCreateSchema>

export const liveMetricsSchema = z.object({
  worker_id: z.string(),
  ts: z.string(),
  cpu_percent: z.number(),
  ram_percent: z.number(),
  bandwidth_in_bps: z.number(),
  bandwidth_out_bps: z.number(),
})
export type LiveMetrics = z.infer<typeof liveMetricsSchema>

export const metricsPointSchema = z.object({
  ts: z.string(),
  cpu_percent: z.number().nullable(),
  ram_percent: z.number().nullable(),
  bandwidth_in_bps: z.number().nullable(),
  bandwidth_out_bps: z.number().nullable(),
})
export type MetricsPoint = z.infer<typeof metricsPointSchema>

export const metricsResponseSchema = z.object({
  worker_id: z.string(),
  interval: z.string(),
  points: z.array(metricsPointSchema),
})
export type MetricsResponse = z.infer<typeof metricsResponseSchema>
