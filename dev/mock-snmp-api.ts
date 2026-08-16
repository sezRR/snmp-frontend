import { randomUUID } from "node:crypto"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { Plugin } from "vite"

// Dev-only stand-in for the FastAPI backend. Serves the same contract
// (REST + SSE + bearer auth) as SNMP metrics API 0.7.0 so the UI is fully
// exercisable before the real backend is reachable. Requests bypass it
// entirely once VITE_API_BASE_URL points at a real origin.

interface Flavor {
  name: string
  vcpus: number
  ram_mb: number
  disk_gb: number
}

interface ServerInfo {
  server_id: string
  name: string
  tenant_name: string
  user_name: string
  status: string
  mac: string
  ipv4: string
  flavor: Flavor
}

interface MachineRow {
  mac: string
  ipv4: string
  label: string | null
  enabled: boolean
  /** Registered with a client-supplied MAC, outside the OpenStack fleet. */
  external: boolean
  /** The SNMP profile polls authenticate with. Null means it is not polled. */
  credential_id: string | null
  created_at: string
  updated_at: string
}

/**
 * A credential as the API returns it — deliberately without the secret, which
 * the real backend encrypts on the way in and never reads back. The mock keeps
 * the plaintext in a separate map for the same reason: nothing that serialises
 * a credential can reach it by accident.
 */
interface CredentialRow {
  id: string
  name: string
  description: string | null
  snmp_version: "2c" | "3"
  username: string | null
  security_level: string | null
  auth_protocol: string | null
  priv_protocol: string | null
  secret_version: number
  fingerprint: string
  created_at: string
  updated_at: string
}

const FLAVORS: Record<string, Flavor> = {
  small: { name: "m1.small", vcpus: 2, ram_mb: 4096, disk_gb: 40 },
  medium: { name: "m1.medium", vcpus: 4, ram_mb: 8192, disk_gb: 80 },
  large: { name: "m1.large", vcpus: 8, ram_mb: 16384, disk_gb: 160 },
}

// The fake OpenStack fleet: the source of truth for MACs and hardware limits.
const openstackServers: ServerInfo[] = [
  {
    server_id: "6f1b0e34-0001-4f0a-9a1e-0b0f00000001",
    name: "core-worker-01",
    tenant_name: "platform",
    user_name: "sezer",
    status: "ACTIVE",
    mac: "fa:16:3e:00:00:01",
    ipv4: "192.168.1.11",
    flavor: FLAVORS.large,
  },
  {
    server_id: "6f1b0e34-0002-4f0a-9a1e-0b0f00000002",
    name: "core-worker-02",
    tenant_name: "platform",
    user_name: "sezer",
    status: "ACTIVE",
    mac: "fa:16:3e:00:00:02",
    ipv4: "192.168.1.12",
    flavor: FLAVORS.medium,
  },
  {
    server_id: "6f1b0e34-0003-4f0a-9a1e-0b0f00000003",
    name: "edge-proxy-01",
    tenant_name: "edge",
    user_name: "ops",
    status: "ACTIVE",
    mac: "fa:16:3e:00:00:03",
    ipv4: "192.168.1.21",
    flavor: FLAVORS.small,
  },
  {
    server_id: "6f1b0e34-0004-4f0a-9a1e-0b0f00000004",
    name: "batch-runner-01",
    tenant_name: "analytics",
    user_name: "ops",
    status: "SHUTOFF",
    mac: "fa:16:3e:00:00:04",
    ipv4: "192.168.1.31",
    flavor: FLAVORS.medium,
  },
  ...stressServers(30),
]

/**
 * A block of servers OpenStack knows and nothing has registered yet.
 *
 * The four hand-written machines above are enough to see a dashboard work;
 * they are not enough to see it under load. These exercise the paths that only
 * hurt at scale: the multi-select and "register all" in the add dialog, the
 * fleet stream fanning out to N connections' worth of samples, and the fleet
 * filters and sorts once the list no longer fits on a screen.
 */
function stressServers(count: number): ServerInfo[] {
  const tenants = ["platform", "edge", "analytics", "research"]
  const users = ["sezer", "ops", "batch", "ci"]
  const flavors = [FLAVORS.small, FLAVORS.medium, FLAVORS.large]

  return Array.from({ length: count }, (_, index) => {
    const n = index + 1
    const octet = (n + 10).toString(16).padStart(2, "0")
    return {
      server_id: `6f1b0e34-1${String(n).padStart(3, "0")}-4f0a-9a1e-0b0f0000${octet}00`,
      name: `stress-node-${String(n).padStart(2, "0")}`,
      tenant_name: tenants[index % tenants.length],
      user_name: users[index % users.length],
      // A couple of shut-off servers, so the fleet is not uniformly healthy.
      status: n % 11 === 0 ? "SHUTOFF" : "ACTIVE",
      mac: `fa:16:3e:00:01:${octet}`,
      ipv4: `10.20.0.${n + 10}`,
      flavor: flavors[index % flavors.length],
    }
  })
}

/** The real collector polls every 5 seconds; the mock keeps to that cadence. */
const POLL_INTERVAL_SECONDS = 5

const now = () => new Date().toISOString()

const FLEET_V3_ID = "c0ffee00-0001-4c8e-9a63-9a1f00000001"
const LEGACY_V2C_ID = "c0ffee00-0002-4c8e-9a63-9a1f00000002"

const credentials: CredentialRow[] = [
  {
    id: FLEET_V3_ID,
    name: "fleet-v3-authpriv",
    description: "SNMPv3 USM identity the OpenStack fleet answers to",
    snmp_version: "3",
    username: "snmpmonitor",
    security_level: "authPriv",
    auth_protocol: "SHA256",
    priv_protocol: "AES128",
    secret_version: 1,
    fingerprint: "sha256:5f2c…a11e",
    created_at: new Date(Date.now() - 604_800_000).toISOString(),
    updated_at: now(),
  },
  {
    id: LEGACY_V2C_ID,
    name: "lab-v2c",
    description: "Community string for the bench boxes that predate v3",
    snmp_version: "2c",
    username: null,
    security_level: null,
    auth_protocol: null,
    priv_protocol: null,
    secret_version: 1,
    fingerprint: "sha256:9b40…7cd2",
    created_at: new Date(Date.now() - 259_200_000).toISOString(),
    updated_at: now(),
  },
]

/** Plaintext secrets, kept apart from anything that gets serialised. */
const credentialSecrets = new Map<string, Record<string, string>>([
  [
    FLEET_V3_ID,
    { auth_passphrase: "monitor-auth", priv_passphrase: "monitor-priv" },
  ],
  [LEGACY_V2C_ID, { community: "public" }],
])

const SECRET_FIELDS = ["community", "auth_passphrase", "priv_passphrase"]

const WEAK_CHOICES = ["MD5", "DES", "noAuthNoPriv"]

const text = (body: Record<string, unknown>, key: string): string | null =>
  typeof body[key] === "string" && body[key] ? body[key] : null

const hasSecret = (body: Record<string, unknown>): boolean =>
  SECRET_FIELDS.some((field) => text(body, field) !== null)

const mintFingerprint = (): string =>
  `sha256:${randomUUID().replaceAll("-", "").slice(0, 4)}…${randomUUID().slice(0, 4)}`

function storeSecret(id: string, body: Record<string, unknown>) {
  const secret: Record<string, string> = {}
  for (const field of SECRET_FIELDS) {
    const value = text(body, field)
    if (value) secret[field] = value
  }
  credentialSecrets.set(id, secret)
}

/**
 * The backend's own validation, restated: a USM shape half-filled in is a row
 * no validator could repair, so the version and the security level decide
 * which fields have to be there together.
 */
function credentialProblem(body: Record<string, unknown>): string | null {
  const version = text(body, "snmp_version")
  if (version !== "2c" && version !== "3") {
    return "snmp_version: must be 2c or 3"
  }
  if (!text(body, "name")) return "name: required"

  if (version === "2c") {
    return text(body, "community") ? null : "community: required for v2c"
  }

  if (!text(body, "username")) return "username: required for v3"
  const level = text(body, "security_level")
  if (!level) return "security_level: required for v3"

  const allowWeak = body.allow_weak === true
  const chosen = [level, text(body, "auth_protocol"), text(body, "priv_protocol")]
  const weak = chosen.find(
    (value) => value !== null && WEAK_CHOICES.includes(value)
  )
  if (weak && !allowWeak) return `${weak} is refused unless allow_weak is set`

  if (level === "authNoPriv" || level === "authPriv") {
    if (!text(body, "auth_protocol")) return "auth_protocol: required"
    if (!text(body, "auth_passphrase")) return "auth_passphrase: required"
  }
  if (level === "authPriv") {
    if (!text(body, "priv_protocol")) return "priv_protocol: required"
    if (!text(body, "priv_passphrase")) return "priv_passphrase: required"
  }
  return null
}

/** A validated body as the row the API returns — without the secret. */
function credentialFrom(
  body: Record<string, unknown>,
  id: string
): CredentialRow {
  const version = text(body, "snmp_version") === "2c" ? "2c" : "3"
  return {
    id,
    name: text(body, "name") ?? "",
    description: text(body, "description"),
    snmp_version: version,
    username: version === "3" ? text(body, "username") : null,
    security_level: version === "3" ? text(body, "security_level") : null,
    auth_protocol: version === "3" ? text(body, "auth_protocol") : null,
    priv_protocol: version === "3" ? text(body, "priv_protocol") : null,
    secret_version: 1,
    fingerprint: mintFingerprint(),
    created_at: now(),
    updated_at: now(),
  }
}

const machines: MachineRow[] = [
  {
    mac: "fa:16:3e:00:00:01",
    ipv4: "192.168.1.11",
    label: "core-worker-01",
    enabled: true,
    external: false,
    credential_id: FLEET_V3_ID,
    created_at: new Date(Date.now() - 86_400_000).toISOString(),
    updated_at: now(),
  },
  {
    mac: "fa:16:3e:00:00:02",
    ipv4: "192.168.1.12",
    label: null,
    enabled: true,
    external: false,
    credential_id: FLEET_V3_ID,
    created_at: new Date(Date.now() - 43_200_000).toISOString(),
    updated_at: now(),
  },
  {
    mac: "fa:16:3e:00:00:03",
    ipv4: "192.168.1.21",
    label: "edge-proxy",
    enabled: true,
    external: false,
    // Registered but never bound, so the "no credential" state — a machine the
    // collector skips entirely — is visible without provoking it.
    credential_id: null,
    created_at: new Date(Date.now() - 7_200_000).toISOString(),
    updated_at: now(),
  },
  // A bare-metal box outside the fleet, so the external paths — no server
  // facts, a patchable address — are visible without registering one first.
  {
    mac: "02:42:ac:11:00:07",
    ipv4: "10.90.0.7",
    label: "lab-bench-01",
    enabled: true,
    external: true,
    credential_id: LEGACY_V2C_ID,
    created_at: new Date(Date.now() - 21_600_000).toISOString(),
    updated_at: now(),
  },
]

// Samples are generated on demand, so a purge is modelled as a floor on the
// timestamps a machine is allowed to return.
const historyFloor = new Map<string, number>()

// --- Fault injection (dev only) -------------------------------------------
// Production will hit unreachable hosts, dead snmpd services and servers that
// vanish from OpenStack. None of that can be provoked against a real fleet on
// demand, so the mock can be told to fake each condition per machine.

const FAULTS = [
  "none",
  "host_down",
  "snmpd_inactive",
  "collection_failed",
  "openstack_deleted",
] as const

type Fault = (typeof FAULTS)[number]

/** What the collector would report as the reason a poll produced nothing. */
const FAULT_ERRORS: Record<Fault, string | null> = {
  none: null,
  host_down: "No SNMP response: request timed out after 3 retries",
  snmpd_inactive: "Connection refused on udp/161 — snmpd is not running",
  collection_failed:
    "SNMP walk failed: no such instance (1.3.6.1.4.1.2021.4.5.0)",
  // The host answers fine; it is OpenStack that has lost the MAC.
  openstack_deleted: null,
}

const faults = new Map<string, Fault>()

const faultOf = (mac: string): Fault => faults.get(mac) ?? "none"

/**
 * A machine whose poll fails contributes no samples at all — and neither does
 * one with no credential bound, which is not polled in the first place.
 */
const pollSucceeds = (mac: string): boolean =>
  FAULT_ERRORS[faultOf(mac)] === null &&
  Boolean(machines.find((machine) => machine.mac === mac)?.credential_id)

const knownToOpenStack = (mac: string): boolean =>
  faultOf(mac) !== "openstack_deleted"

/** The fleet as the lookup would see it, minus anything faked as deleted. */
const visibleServers = (): ServerInfo[] =>
  openstackServers.filter((server) => knownToOpenStack(server.mac))

interface MachineStat {
  mac: string
  ipv4: string
  ok_count: number
  fail_count: number
  last_ok: string | null
  last_error: string | null
  last_error_at: string | null
}

const collector = {
  enabled: true,
  running: true,
  interval_seconds: POLL_INTERVAL_SECONDS,
  effective_interval_seconds: POLL_INTERVAL_SECONDS,
  overrun_count: 0,
  tick_count: 412,
  last_tick_at: now(),
  last_tick_duration_seconds: 0.42,
  last_inserted: 0,
  last_failed: 0,
  last_tick_error: null as string | null,
  machines: {} as Record<string, MachineStat>,
}

const statFor = (machine: MachineRow): MachineStat =>
  (collector.machines[machine.mac] ??= {
    mac: machine.mac,
    ipv4: machine.ipv4,
    ok_count: 0,
    fail_count: 0,
    last_ok: null,
    last_error: null,
    last_error_at: null,
  })

/** One collection round, shared by the timer and the force-tick endpoint. */
function runTick() {
  const at = now()
  collector.tick_count += 1
  collector.last_tick_at = at
  collector.last_tick_duration_seconds = round(0.2 + Math.random() * 0.5)

  let stored = 0
  let failed = 0
  for (const machine of machines) {
    const stat = statFor(machine)
    stat.ipv4 = machine.ipv4
    if (!machine.enabled) continue
    // Nothing to authenticate with means the machine is not polled at all —
    // not polled and failing, which is a different thing and a different dot.
    if (!machine.credential_id) continue
    const error = FAULT_ERRORS[faultOf(machine.mac)]
    if (error) {
      stat.fail_count += 1
      // The error and its timestamp both survive a later success: which of
      // last_ok and last_error_at is newer is what says how the poll went.
      stat.last_error = error
      stat.last_error_at = at
      failed += 1
    } else {
      stat.ok_count += 1
      stat.last_ok = at
      stored += 1
    }
  }
  collector.last_inserted = stored
  collector.last_failed = failed
  return { stored, failed }
}

const cache = {
  ttl_seconds: 300,
  fetched_at: now(),
  hits: 128,
  misses: 4,
  refreshes: 3,
  populated: true,
  last_error: null as string | null,
}

for (const machine of machines) {
  collector.machines[machine.mac] = {
    mac: machine.mac,
    ipv4: machine.ipv4,
    ok_count: 380 + Math.floor(Math.random() * 30),
    fail_count: 0,
    last_ok: now(),
    last_error: null,
    last_error_at: null,
  }
}

const MAC_PATTERN = /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/

/** Both separators are accepted; the colon form is what gets stored. */
const normalizeMac = (value: string): string =>
  value.trim().toLowerCase().replaceAll("-", ":")

function serverFor(mac: string): ServerInfo | null {
  if (!cache.populated) return null
  if (!knownToOpenStack(mac)) return null
  return openstackServers.find((server) => server.mac === mac) ?? null
}

function machineResponse(machine: MachineRow) {
  // An external machine has no record to look up, by definition.
  const openstack = machine.external ? null : serverFor(machine.mac)
  return { ...machine, openstack, openstack_found: openstack !== null }
}

const MIB = 1024 ** 2
const GIB = 1024 ** 3

/** The mount table of a host that does more than run one service. */
const EXTRA_MOUNTS = [
  { mount: "/home", device: "vdc1", gb: 200, base: 55 },
  { mount: "/srv", device: "vdc2", gb: 100, base: 40 },
  { mount: "/var/log", device: "vdd1", gb: 30, base: 70 },
  { mount: "/var/lib/docker", device: "vdd2", gb: 120, base: 62 },
  { mount: "/opt", device: "vde1", gb: 50, base: 25 },
  { mount: "/data", device: "vde2", gb: 500, base: 81 },
  { mount: "/boot", device: "vda2", gb: 1, base: 35 },
]
const LINK_SPEED_BPS = 10_000_000_000

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

// Deterministic per-machine pseudo-metrics: smooth sinusoids plus jitter, so
// reloading the page does not redraw a completely different history.
function metricsAt(mac: string, timeMs: number) {
  const server = openstackServers.find((entry) => entry.mac === mac)
  const flavor = server?.flavor ?? FLAVORS.medium
  const seed = [...mac].reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const t = timeMs / 60_000
  const wave = (period: number, phase: number) =>
    (Math.sin((t / period) * 2 * Math.PI + seed + phase) + 1) / 2
  const jitter = (spread: number) => (Math.random() - 0.5) * spread

  const ramTotal = flavor.ram_mb * MIB
  const ramPercent = clamp(45 + wave(43, 2) * 30 + jitter(4), 5, 98)
  const diskTotal = flavor.disk_gb * GIB
  const diskPercent = clamp(50 + wave(210, 5) * 18 + jitter(0.4), 5, 97)
  const varTotal = 20 * GIB
  const varPercent = clamp(30 + wave(150, 1) * 25 + jitter(0.4), 3, 96)
  const rxBps = Math.round(
    (30 + wave(11, 4) * 400) * 1e6 * (1 + Math.random() * 0.1)
  )
  const txBps = Math.round(
    (5 + wave(13, 1) * 60) * 1e6 * (1 + Math.random() * 0.1)
  )

  // Disk IO is counted in bytes, unlike the network counters. Root carries the
  // bulk of the reads; /var takes the writes, as a log-heavy mount would.
  const rootRead = Math.round((4 + wave(7, 3) * 90) * MIB)
  const rootWrite = Math.round((1 + wave(9, 6) * 22) * MIB)
  const varRead = Math.round((0.5 + wave(23, 2) * 6) * MIB)
  const varWrite = Math.round((2 + wave(5, 5) * 30) * MIB)
  // ~64 KiB per operation on the reads, ~16 KiB on the smaller writes.
  const iopsFor = (bytes: number, size: number) => round(bytes / size)

  /**
   * Extra filesystems, on a third of the fleet. Real hosts running containers
   * report a mount table far longer than the two below — that is the case the
   * disk card has to fold, so some of the mock fleet has to produce it.
   */
  const extraMounts = () => {
    if (seed % 3 !== 0) return []
    return EXTRA_MOUNTS.map((entry, index) => {
      const total = entry.gb * GIB
      const percent = clamp(
        entry.base + wave(60 + index * 17, index) * 30 + jitter(0.4),
        2,
        99
      )
      const read = Math.round((0.2 + wave(19 + index, index) * 4) * MIB)
      const write = Math.round((0.2 + wave(13 + index, index) * 3) * MIB)
      return {
        mount: entry.mount,
        device: entry.device,
        used_bytes: Math.round((percent / 100) * total),
        total_bytes: total,
        used_percent: round(percent),
        read_bps: read,
        write_bps: write,
        read_iops: iopsFor(read, 64 * 1024),
        write_iops: iopsFor(write, 16 * 1024),
      }
    })
  }

  return {
    ts: new Date(timeMs).toISOString(),
    mac,
    metrics: {
      cpu: {
        cores: flavor.vcpus,
        usage_percent: round(clamp(20 + wave(17, 0) * 55 + jitter(6), 1, 99)),
      },
      ram: {
        used_bytes: Math.round((ramPercent / 100) * ramTotal),
        total_bytes: ramTotal,
        used_percent: round(ramPercent),
      },
      disk: [
        {
          mount: "/",
          device: "vda1",
          used_bytes: Math.round((diskPercent / 100) * diskTotal),
          total_bytes: diskTotal,
          used_percent: round(diskPercent),
          read_bps: rootRead,
          write_bps: rootWrite,
          read_iops: iopsFor(rootRead, 64 * 1024),
          write_iops: iopsFor(rootWrite, 16 * 1024),
        },
        {
          mount: "/var",
          device: "vdb1",
          used_bytes: Math.round((varPercent / 100) * varTotal),
          total_bytes: varTotal,
          used_percent: round(varPercent),
          read_bps: varRead,
          write_bps: varWrite,
          read_iops: iopsFor(varRead, 64 * 1024),
          write_iops: iopsFor(varWrite, 16 * 1024),
        },
        ...extraMounts(),
      ],
      disk_io: {
        read_bps: rootRead + varRead,
        write_bps: rootWrite + varWrite,
        read_iops: iopsFor(rootRead + varRead, 64 * 1024),
        write_iops: iopsFor(rootWrite + varWrite, 16 * 1024),
        interval_seconds: POLL_INTERVAL_SECONDS,
      },
      network: {
        rx_bps: rxBps,
        tx_bps: txBps,
        // Counters as if the interface had been running at this rate for a day.
        rx_bytes: Math.round((rxBps / 8) * 86_400),
        tx_bytes: Math.round((txBps / 8) * 86_400),
        interval_seconds: POLL_INTERVAL_SECONDS,
        interfaces: [
          {
            name: "eth0",
            rx_bps: rxBps,
            tx_bps: txBps,
            speed_bps: LINK_SPEED_BPS,
            rx_util_percent: round((rxBps / LINK_SPEED_BPS) * 100),
            tx_util_percent: round((txBps / LINK_SPEED_BPS) * 100),
          },
        ],
      },
    },
  }
}

const round = (value: number) => Number(value.toFixed(2))

/** Parses the Postgres interval strings the stats endpoint accepts. */
function intervalMs(bucket: string): number {
  const match = /^\s*(\d+(?:\.\d+)?)\s*(second|minute|hour|day)s?\s*$/i.exec(
    bucket
  )
  if (!match) return 300_000
  const amount = Number(match[1])
  const unit = match[2].toLowerCase()
  const scale =
    unit === "second"
      ? 1000
      : unit === "minute"
        ? 60_000
        : unit === "hour"
          ? 3_600_000
          : 86_400_000
  return amount * scale
}

function pollableMacs(filter: string[] | null): string[] {
  const macs = machines
    .filter((machine) => pollSucceeds(machine.mac))
    .map((machine) => machine.mac)
  return filter && filter.length > 0
    ? macs.filter((mac) => filter.includes(mac))
    : macs
}

function visibleAt(mac: string, timeMs: number): boolean {
  const floor = historyFloor.get(mac)
  return floor === undefined || timeMs > floor
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" })
  res.end(JSON.stringify(body))
}

async function readRaw(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString("utf8")
}

async function readBody(
  req: IncomingMessage
): Promise<Record<string, unknown>> {
  const raw = await readRaw(req)
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
}

/** `/auth/login` is the one endpoint that takes a form, per the OAuth2 flow. */
async function readForm(req: IncomingMessage): Promise<Record<string, string>> {
  return Object.fromEntries(new URLSearchParams(await readRaw(req)))
}

// --- Auth -----------------------------------------------------------------
// Enough of the real thing to exercise the client: bearer access tokens,
// rotating refresh tokens, single-use stream tickets, and scopes that actually
// refuse. Sign in as admin/admin for everything, or viewer/viewer to see the
// read-only UI — which is the half of the behaviour a permissive mock hides.

const ALL_SCOPES = [
  "machines:read",
  "machines:write",
  "metrics:read",
  "metrics:write",
  "admin:read",
  "admin:write",
  "users:read",
  "users:write",
  "roles:read",
  "roles:write",
  "credentials:read",
  "credentials:write",
]

const ROLE_SCOPES: Record<string, string[]> = {
  admin: ALL_SCOPES,
  operator: [
    "machines:read",
    "machines:write",
    "metrics:read",
    "metrics:write",
    "admin:read",
    "admin:write",
    "credentials:read",
    "credentials:write",
  ],
  // Reading a credential profile never reveals a secret, but it does reveal
  // the fleet's USM identities, so a viewer is not given even that.
  viewer: ["machines:read", "metrics:read"],
}

interface MockUser {
  id: string
  username: string
  password: string
  is_active: boolean
  roles: string[]
  created_at: string
  updated_at: string
}

const users: MockUser[] = [
  {
    id: "0a5f2d5c-0001-4c8e-9a63-9a1f00000001",
    username: "admin",
    password: "admin",
    is_active: true,
    roles: ["admin"],
    created_at: new Date(Date.now() - 604_800_000).toISOString(),
    updated_at: now(),
  },
  {
    id: "0a5f2d5c-0002-4c8e-9a63-9a1f00000002",
    username: "viewer",
    password: "viewer",
    is_active: true,
    roles: ["viewer"],
    created_at: new Date(Date.now() - 604_800_000).toISOString(),
    updated_at: now(),
  },
]

const ACCESS_TTL_SECONDS = 300
const REFRESH_TTL_SECONDS = 86_400
const TICKET_TTL_SECONDS = 15

interface Issued {
  username: string
  expires_at: number
}

const accessTokens = new Map<string, Issued>()
const refreshTokens = new Map<string, Issued>()
const streamTickets = new Map<string, Issued>()

const mint = () =>
  randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "")

function redeem(
  store: Map<string, Issued>,
  token: string | null
): Issued | null {
  if (!token) return null
  const issued = store.get(token)
  if (!issued) return null
  if (issued.expires_at < Date.now()) {
    store.delete(token)
    return null
  }
  return issued
}

function issuePair(username: string) {
  const access = mint()
  const refresh = mint()
  accessTokens.set(access, {
    username,
    expires_at: Date.now() + ACCESS_TTL_SECONDS * 1000,
  })
  refreshTokens.set(refresh, {
    username,
    expires_at: Date.now() + REFRESH_TTL_SECONDS * 1000,
  })
  return {
    access_token: access,
    refresh_token: refresh,
    token_type: "bearer",
    expires_in: ACCESS_TTL_SECONDS,
  }
}

/** Ends every session a user has — what a password change does. */
function revokeAllFor(username: string) {
  for (const [token, issued] of refreshTokens) {
    if (issued.username === username) refreshTokens.delete(token)
  }
  for (const [token, issued] of accessTokens) {
    if (issued.username === username) accessTokens.delete(token)
  }
}

const scopesOf = (user: MockUser): string[] => [
  ...new Set(user.roles.flatMap((role) => ROLE_SCOPES[role] ?? [])),
]

const userByName = (username: string): MockUser | undefined =>
  users.find((user) => user.username === username)

const userResponse = (user: MockUser) => ({
  id: user.id,
  username: user.username,
  is_active: user.is_active,
  roles: user.roles,
  scopes: scopesOf(user),
  created_at: user.created_at,
  updated_at: user.updated_at,
})

/** Everything reachable without a token. */
const PUBLIC_PATHS = new Set([
  "/",
  "/healthz",
  "/readyz",
  "/auth/login",
  "/auth/refresh",
])

/** The scope the real backend's dependency would demand for this request. */
function requiredScope(path: string, method: string): string | null {
  if (path.startsWith("/admin")) {
    return method === "GET" ? "admin:read" : "admin:write"
  }
  if (path === "/auth/stream-ticket") return "metrics:read"
  if (path.startsWith("/snmp-credentials")) {
    return method === "GET" ? "credentials:read" : "credentials:write"
  }
  if (path.startsWith("/machines")) {
    if (path.endsWith("/metrics/stream")) return "metrics:read"
    if (path.endsWith("/metrics")) return "metrics:write"
    // Binding a shared credential to a machine is what would aim the next
    // authenticated poll somewhere new, so it costs the credential scope
    // rather than the machine one.
    if (path.includes("/snmp-credential")) return "credentials:write"
    return method === "GET" ? "machines:read" : "machines:write"
  }
  if (path.startsWith("/metrics")) {
    return method === "DELETE" ? "metrics:write" : "metrics:read"
  }
  return null
}

/**
 * Who is calling. A header for ordinary requests; for the two SSE endpoints a
 * single-use ticket in the query string, since EventSource cannot send headers.
 */
function callerFor(
  req: IncomingMessage,
  url: URL,
  path: string
): MockUser | null {
  const header = req.headers.authorization
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null
  const issued =
    redeem(accessTokens, bearer) ??
    (path.endsWith("/metrics/stream")
      ? redeemTicket(url.searchParams.get("ticket"))
      : null)
  if (!issued) return null
  const user = userByName(issued.username)
  return user?.is_active ? user : null
}

/** Spent by the connection it opens, whether or not that connection lasts. */
function redeemTicket(ticket: string | null): Issued | null {
  const issued = redeem(streamTickets, ticket)
  if (ticket) streamTickets.delete(ticket)
  return issued
}

function openStream(req: IncomingMessage, res: ServerResponse, macs: string[]) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  })
  res.write(`event: connected\ndata: ${JSON.stringify({ macs: "all" })}\n\n`)
  const metricsTimer = setInterval(() => {
    for (const mac of macs) {
      const payload = JSON.stringify(metricsAt(mac, Date.now()))
      // Same event name the real collector uses, so the mock exercises the
      // same client path.
      res.write(`event: metric\ndata: ${payload}\n\n`)
    }
  }, POLL_INTERVAL_SECONDS * 1000)
  const heartbeatTimer = setInterval(() => res.write(": ping\n\n"), 15_000)
  req.on("close", () => {
    clearInterval(metricsTimer)
    clearInterval(heartbeatTimer)
  })
}

export function mockSnmpApi({ prefix = "/api" } = {}): Plugin {
  return {
    name: "mock-snmp-api",
    apply: "serve",
    configureServer(server) {
      // A real collector advances on its own, and the UI's "last tick" counter
      // is only honest if this one does too.
      const loop = setInterval(runTick, collector.interval_seconds * 1000)
      server.httpServer?.on("close", () => clearInterval(loop))

      server.middlewares.use(prefix, (req, res, next) => {
        void handle(req, res).catch((error: unknown) =>
          json(res, 500, { detail: `Mock API error: ${String(error)}` })
        )

        async function handle(req: IncomingMessage, res: ServerResponse) {
          const url = new URL(req.url ?? "/", "http://localhost")
          const path = url.pathname.replace(/\/$/, "") || "/"
          const method = req.method ?? "GET"
          const macFilter = url.searchParams.getAll("mac")

          if (path === "/healthz" || path === "/readyz" || path === "/") {
            return json(res, 200, { status: "ok", mock: "true" })
          }

          // --- auth ---------------------------------------------------------
          if (path === "/auth/login" && method === "POST") {
            const form = await readForm(req)
            const user = userByName(form.username ?? "")
            if (!user || user.password !== form.password || !user.is_active) {
              return json(res, 401, {
                detail: "Incorrect username or password",
              })
            }
            return json(res, 200, issuePair(user.username))
          }

          if (path === "/auth/refresh" && method === "POST") {
            const body = await readBody(req)
            const token =
              typeof body.refresh_token === "string" ? body.refresh_token : null
            const issued = redeem(refreshTokens, token)
            if (!issued) {
              return json(res, 401, { detail: "Invalid refresh token" })
            }
            // Rotation: the presented token is spent, exactly as the real one
            // is, so a client that replays it gets the 401 it should.
            if (token) refreshTokens.delete(token)
            return json(res, 200, issuePair(issued.username))
          }

          // Everything past here needs a caller.
          const caller = PUBLIC_PATHS.has(path)
            ? null
            : callerFor(req, url, path)
          if (!PUBLIC_PATHS.has(path) && !path.startsWith("/__dev/")) {
            if (!caller) {
              return json(res, 401, { detail: "Not authenticated" })
            }
            const scope = requiredScope(path, method)
            if (scope && !scopesOf(caller).includes(scope)) {
              return json(res, 403, { detail: `Requires the ${scope} scope` })
            }
          }

          if (path === "/auth/logout" && method === "POST") {
            const body = await readBody(req)
            if (typeof body.refresh_token === "string") {
              refreshTokens.delete(body.refresh_token)
            }
            res.writeHead(204)
            return res.end()
          }

          if (path === "/auth/me" && method === "GET") {
            return json(res, 200, userResponse(caller as MockUser))
          }

          if (path === "/auth/me/password" && method === "PATCH") {
            const body = await readBody(req)
            const user = caller as MockUser
            if (body.current_password !== user.password) {
              return json(res, 401, { detail: "Incorrect password" })
            }
            if (typeof body.new_password !== "string" || !body.new_password) {
              return json(res, 422, { detail: "new_password: required" })
            }
            user.password = body.new_password
            user.updated_at = now()
            // Every other session ends; the caller gets a fresh pair so this
            // one does not.
            revokeAllFor(user.username)
            return json(res, 200, issuePair(user.username))
          }

          if (path === "/auth/stream-ticket" && method === "POST") {
            const ticket = mint()
            streamTickets.set(ticket, {
              username: (caller as MockUser).username,
              expires_at: Date.now() + TICKET_TTL_SECONDS * 1000,
            })
            return json(res, 200, {
              ticket,
              expires_in: TICKET_TTL_SECONDS,
            })
          }

          // --- machines -------------------------------------------------
          if (path === "/machines" && method === "GET") {
            const enabledOnly = url.searchParams.get("enabled_only") === "true"
            const rows = enabledOnly
              ? machines.filter((machine) => machine.enabled)
              : machines
            return json(res, 200, rows.map(machineResponse))
          }

          if (path === "/machines" && method === "POST") {
            const body = await readBody(req)
            const ipv4 = typeof body.ipv4 === "string" ? body.ipv4 : ""
            const label = typeof body.label === "string" ? body.label : null
            if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ipv4)) {
              return json(res, 422, {
                detail: `Not an IPv4 address: ${ipv4 || "(missing)"}`,
              })
            }
            const supplied =
              typeof body.mac === "string" ? normalizeMac(body.mac) : null
            if (supplied !== null && !MAC_PATTERN.test(supplied)) {
              return json(res, 422, {
                detail: `Not a MAC address: ${String(body.mac)}`,
              })
            }
            const known = visibleServers().find((entry) => entry.ipv4 === ipv4)
            // Outside the fleet nothing can resolve the identity, so the client
            // supplies it. Inside it, only the fleet's own MAC is accepted —
            // otherwise the two would disagree about what is being polled.
            if (!known && supplied === null) {
              return json(res, 422, {
                detail: `OpenStack has no record of ${ipv4}: supply its MAC to register it as an external machine`,
              })
            }
            if (known && supplied !== null && supplied !== known.mac) {
              return json(res, 422, {
                detail: `OpenStack knows ${ipv4} as ${known.mac}, not ${supplied}`,
              })
            }
            const mac = known?.mac ?? (supplied as string)
            if (machines.some((machine) => machine.mac === mac)) {
              return json(res, 409, {
                detail: `Machine ${mac} is already registered`,
              })
            }
            const machine: MachineRow = {
              mac,
              ipv4,
              label,
              enabled: true,
              external: !known,
              // Registration never binds: the credential is a second call, so
              // a machine can exist before anyone knows how to poll it.
              credential_id: null,
              created_at: now(),
              updated_at: now(),
            }
            machines.push(machine)
            statFor(machine)
            return json(res, 201, machineResponse(machine))
          }

          const machineMatch = /^\/machines\/([^/]+)$/.exec(path)
          if (machineMatch) {
            const mac = decodeURIComponent(machineMatch[1])
            const index = machines.findIndex((machine) => machine.mac === mac)
            if (index === -1) {
              return json(res, 404, { detail: `Machine ${mac} not found` })
            }
            if (method === "GET") {
              return json(res, 200, machineResponse(machines[index]))
            }
            if (method === "PATCH") {
              const body = await readBody(req)
              if ("label" in body) {
                machines[index].label =
                  typeof body.label === "string" ? body.label : null
              }
              if (typeof body.enabled === "boolean") {
                machines[index].enabled = body.enabled
              }
              if (typeof body.ipv4 === "string") {
                // OpenStack owns a managed machine's address and the collector
                // re-reads it every tick, so patching it would last one round.
                if (!machines[index].external) {
                  return json(res, 422, {
                    detail: `OpenStack owns the address of ${mac}; only external machines can be moved`,
                  })
                }
                if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(body.ipv4)) {
                  return json(res, 422, {
                    detail: `Not an IPv4 address: ${body.ipv4}`,
                  })
                }
                machines[index].ipv4 = body.ipv4
              }
              machines[index].updated_at = now()
              return json(res, 200, machineResponse(machines[index]))
            }
            if (method === "DELETE") {
              machines.splice(index, 1)
              delete collector.machines[mac]
              historyFloor.delete(mac)
              res.writeHead(204)
              return res.end()
            }
          }

          // --- snmp credentials -----------------------------------------
          if (path === "/snmp-credentials" && method === "GET") {
            return json(res, 200, credentials)
          }

          if (path === "/snmp-credentials" && method === "POST") {
            const body = await readBody(req)
            const invalid = credentialProblem(body)
            if (invalid) return json(res, 422, { detail: invalid })
            const row = credentialFrom(body, randomUUID())
            credentials.push(row)
            storeSecret(row.id, body)
            return json(res, 201, row)
          }

          const credentialMatch = /^\/snmp-credentials\/([^/]+)$/.exec(path)
          if (credentialMatch) {
            const id = decodeURIComponent(credentialMatch[1])
            const index = credentials.findIndex((entry) => entry.id === id)
            if (index === -1) {
              return json(res, 404, { detail: `Credential ${id} not found` })
            }
            if (method === "GET") return json(res, 200, credentials[index])
            if (method === "PATCH") {
              const body = await readBody(req)
              const invalid = credentialProblem(body)
              if (invalid) return json(res, 422, { detail: invalid })
              const previous = credentials[index]
              const row = credentialFrom(body, id)
              // Any secret in the body replaces the stored one wholesale, and
              // the version is what makes that visible to a client.
              const rotated = hasSecret(body)
              credentials[index] = {
                ...row,
                secret_version: previous.secret_version + (rotated ? 1 : 0),
                fingerprint: rotated ? mintFingerprint() : previous.fingerprint,
                created_at: previous.created_at,
              }
              if (rotated) storeSecret(id, body)
              return json(res, 200, credentials[index])
            }
            if (method === "DELETE") {
              // The FK is RESTRICT on the real backend; checking here is what
              // turns that into a 409 naming the machines rather than a 500.
              const bound = machines.filter(
                (machine) => machine.credential_id === id
              )
              if (bound.length > 0) {
                return json(res, 409, {
                  detail: `Still bound to ${bound.map((machine) => machine.mac).join(", ")}`,
                })
              }
              credentials.splice(index, 1)
              credentialSecrets.delete(id)
              res.writeHead(204)
              return res.end()
            }
          }

          const bindMatch = /^\/machines\/([^/]+)\/snmp-credential$/.exec(path)
          if (bindMatch) {
            const mac = decodeURIComponent(bindMatch[1])
            const machine = machines.find((entry) => entry.mac === mac)
            if (!machine) {
              return json(res, 404, { detail: `Machine ${mac} not found` })
            }
            if (method === "PUT") {
              const body = await readBody(req)
              const id =
                typeof body.credential_id === "string"
                  ? body.credential_id
                  : null
              if (!id || !credentials.some((entry) => entry.id === id)) {
                return json(res, 422, {
                  detail: `No such credential: ${id ?? "(missing)"}`,
                })
              }
              machine.credential_id = id
              machine.updated_at = now()
              return json(res, 200, machineResponse(machine))
            }
            if (method === "DELETE") {
              machine.credential_id = null
              machine.updated_at = now()
              res.writeHead(204)
              return res.end()
            }
          }

          const testMatch = /^\/machines\/([^/]+)\/snmp-credential\/test$/.exec(
            path
          )
          if (testMatch && method === "POST") {
            const mac = decodeURIComponent(testMatch[1])
            const machine = machines.find((entry) => entry.mac === mac)
            if (!machine) {
              return json(res, 404, { detail: `Machine ${mac} not found` })
            }
            const body = await readBody(req)
            const inline = body.credential as Record<string, unknown> | null
            if (inline) {
              const invalid = credentialProblem(inline)
              if (invalid) return json(res, 422, { detail: invalid })
            }
            if (!inline && !machine.credential_id) {
              return json(res, 422, {
                detail: `${mac} has no credential bound, and none was supplied`,
              })
            }
            // The address is the machine's own and comes from nowhere else —
            // the endpoint takes none, deliberately. Whether the poll answers
            // is the fault injector's business, exactly as a real one is.
            const error = FAULT_ERRORS[faultOf(mac)]
            return json(res, 200, {
              ok: error === null,
              ipv4: machine.ipv4,
              credential_id: inline ? null : machine.credential_id,
              duration_seconds: round(0.1 + Math.random() * 0.6),
              detail: error,
              simulated: true,
            })
          }

          const machineMetricsMatch = /^\/machines\/([^/]+)\/metrics$/.exec(
            path
          )
          if (machineMetricsMatch && method === "DELETE") {
            const mac = decodeURIComponent(machineMetricsMatch[1])
            const before = url.searchParams.get("before")
            historyFloor.set(mac, before ? Date.parse(before) : Date.now())
            return json(res, 200, {
              scope: "machine",
              mac,
              before,
              method: before ? "drop_chunks" : "delete",
              rows_deleted: before ? null : 1440,
            })
          }

          const machineStreamMatch =
            /^\/machines\/([^/]+)\/metrics\/stream$/.exec(path)
          if (machineStreamMatch && method === "GET") {
            // A failing machine still accepts the connection; it just never
            // produces an event, which is what the real stream does.
            return openStream(
              req,
              res,
              [decodeURIComponent(machineStreamMatch[1])].filter(pollSucceeds)
            )
          }

          // --- metrics --------------------------------------------------
          if (path === "/metrics/stream" && method === "GET") {
            return openStream(req, res, pollableMacs(macFilter))
          }

          if (path === "/metrics/latest" && method === "GET") {
            const timeMs = Date.now()
            return json(
              res,
              200,
              machines
                .filter(
                  (machine) =>
                    visibleAt(machine.mac, timeMs) && pollSucceeds(machine.mac)
                )
                .map((machine) => metricsAt(machine.mac, timeMs))
            )
          }

          if (path === "/metrics/stats" && method === "GET") {
            const hours = Number(url.searchParams.get("hours") ?? "1")
            const step = intervalMs(
              url.searchParams.get("bucket") ?? "5 minutes"
            )
            const end = Math.floor(Date.now() / step) * step
            const start = end - hours * 3_600_000
            const rows = []
            for (const mac of pollableMacs(macFilter)) {
              for (let ts = start; ts <= end; ts += step) {
                if (!visibleAt(mac, ts)) continue
                const sample = metricsAt(mac, ts)
                const disk = sample.metrics.disk[0]
                rows.push({
                  bucket: new Date(ts).toISOString(),
                  mac,
                  samples: Math.max(
                    1,
                    Math.round(step / (POLL_INTERVAL_SECONDS * 1000))
                  ),
                  cpu_usage_percent_avg: sample.metrics.cpu.usage_percent,
                  cpu_usage_percent_max: round(
                    clamp(sample.metrics.cpu.usage_percent * 1.15, 0, 100)
                  ),
                  ram_used_percent_avg: sample.metrics.ram.used_percent,
                  ram_used_percent_max: round(
                    clamp(sample.metrics.ram.used_percent * 1.05, 0, 100)
                  ),
                  disk_used_percent_avg: disk.used_percent,
                  disk_used_percent_max: disk.used_percent,
                  disk_read_bps_avg: sample.metrics.disk_io.read_bps,
                  disk_read_bps_max: Math.round(
                    sample.metrics.disk_io.read_bps * 1.4
                  ),
                  disk_write_bps_avg: sample.metrics.disk_io.write_bps,
                  disk_write_bps_max: Math.round(
                    sample.metrics.disk_io.write_bps * 1.4
                  ),
                  disk_read_iops_avg: sample.metrics.disk_io.read_iops,
                  disk_read_iops_max: round(
                    sample.metrics.disk_io.read_iops * 1.4
                  ),
                  disk_write_iops_avg: sample.metrics.disk_io.write_iops,
                  disk_write_iops_max: round(
                    sample.metrics.disk_io.write_iops * 1.4
                  ),
                  net_rx_bps_avg: sample.metrics.network.rx_bps,
                  net_rx_bps_max: Math.round(
                    sample.metrics.network.rx_bps * 1.3
                  ),
                  net_tx_bps_avg: sample.metrics.network.tx_bps,
                  net_tx_bps_max: Math.round(
                    sample.metrics.network.tx_bps * 1.3
                  ),
                })
              }
            }
            return json(res, 200, rows)
          }

          if (path === "/metrics/counts" && method === "GET") {
            const timeMs = Date.now()
            return json(
              res,
              200,
              machines.map((machine) => ({
                mac: machine.mac,
                // History survives a fault; only new samples stop arriving.
                samples: visibleAt(machine.mac, timeMs) ? 2880 : 0,
                latest:
                  visibleAt(machine.mac, timeMs) && pollSucceeds(machine.mac)
                    ? new Date(timeMs).toISOString()
                    : null,
              }))
            )
          }

          if (path === "/metrics" && method === "GET") {
            const limit = Math.min(
              5000,
              Number(url.searchParams.get("limit") ?? "100")
            )
            const since = url.searchParams.get("since")
            const sinceMs = since ? Date.parse(since) : null
            const macs = pollableMacs(macFilter)
            const samples = []
            const step = POLL_INTERVAL_SECONDS * 1000
            let ts = Math.floor(Date.now() / step) * step
            while (samples.length < limit && ts > Date.now() - 86_400_000) {
              if (sinceMs !== null && ts < sinceMs) break
              for (const mac of macs) {
                if (samples.length >= limit) break
                if (!visibleAt(mac, ts)) continue
                samples.push(metricsAt(mac, ts))
              }
              ts -= step
            }
            return json(res, 200, samples)
          }

          if (path === "/metrics" && method === "DELETE") {
            if (url.searchParams.get("confirm") !== "true") {
              return json(res, 422, {
                detail: "confirm=true is required to purge every machine",
              })
            }
            const before = url.searchParams.get("before")
            const floor = before ? Date.parse(before) : Date.now()
            for (const machine of machines) historyFloor.set(machine.mac, floor)
            return json(res, 200, {
              scope: "all",
              mac: null,
              before,
              method: before ? "drop_chunks" : "truncate",
              rows_deleted: null,
            })
          }

          // --- admin ----------------------------------------------------
          if (path === "/admin/collector" && method === "GET") {
            // The real loop reports its per-machine counters as a list.
            return json(res, 200, {
              ...collector,
              machines: Object.values(collector.machines),
            })
          }

          if (path === "/admin/collector/tick" && method === "POST") {
            return json(res, 200, runTick())
          }

          if (path === "/admin/openstack/cache" && method === "GET") {
            const fetchedMs = Date.parse(cache.fetched_at)
            return json(res, 200, {
              ttl_seconds: cache.ttl_seconds,
              populated: cache.populated,
              fetched_at: cache.populated ? cache.fetched_at : null,
              age_seconds: cache.populated
                ? round((Date.now() - fetchedMs) / 1000)
                : null,
              servers: cache.populated ? visibleServers().length : 0,
              hits: cache.hits,
              misses: cache.misses,
              refreshes: cache.refreshes,
              last_error: cache.last_error,
            })
          }

          if (path === "/admin/openstack/servers" && method === "GET") {
            cache.hits += 1
            if (!cache.populated) {
              cache.populated = true
              cache.fetched_at = now()
              cache.refreshes += 1
            }
            return json(res, 200, visibleServers())
          }

          if (path === "/admin/openstack/cache/flush" && method === "POST") {
            const dropped = cache.populated ? visibleServers().length : 0
            cache.populated = false
            return json(res, 200, { flushed: true, dropped_servers: dropped })
          }

          // --- dev-only fault injection ---------------------------------
          if (path === "/__dev/faults" && method === "GET") {
            return json(res, 200, {
              available: FAULTS,
              faults: Object.fromEntries(
                machines.map((machine) => [machine.mac, faultOf(machine.mac)])
              ),
            })
          }

          if (path === "/__dev/faults" && method === "POST") {
            const body = await readBody(req)
            const mac = typeof body.mac === "string" ? body.mac : ""
            const fault = body.fault as Fault
            if (!machines.some((machine) => machine.mac === mac)) {
              return json(res, 404, { detail: `Machine ${mac} not found` })
            }
            if (!FAULTS.includes(fault)) {
              return json(res, 422, {
                detail: `Unknown fault: ${String(body.fault)}`,
              })
            }
            if (fault === "none") faults.delete(mac)
            else faults.set(mac, fault)
            return json(res, 200, { mac, fault })
          }

          if (path === "/__dev/faults" && method === "DELETE") {
            const cleared = faults.size
            faults.clear()
            return json(res, 200, { cleared })
          }

          next()
        }
      })
    },
  }
}
