import type { IncomingMessage, ServerResponse } from "node:http"
import type { Plugin } from "vite"

// Dev-only stand-in for the FastAPI backend. Serves the same /api contract
// (REST + SSE) as SNMP metrics API 0.5.0 so the UI is fully exercisable before
// the real backend is reachable. Requests bypass it entirely once
// VITE_API_BASE_URL points at a real origin.

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
]

const now = () => new Date().toISOString()

const machines: MachineRow[] = [
  {
    mac: "fa:16:3e:00:00:01",
    ipv4: "192.168.1.11",
    label: "core-worker-01",
    enabled: true,
    created_at: new Date(Date.now() - 86_400_000).toISOString(),
    updated_at: now(),
  },
  {
    mac: "fa:16:3e:00:00:02",
    ipv4: "192.168.1.12",
    label: null,
    enabled: true,
    created_at: new Date(Date.now() - 43_200_000).toISOString(),
    updated_at: now(),
  },
  {
    mac: "fa:16:3e:00:00:03",
    ipv4: "192.168.1.21",
    label: "edge-proxy",
    enabled: true,
    created_at: new Date(Date.now() - 7_200_000).toISOString(),
    updated_at: now(),
  },
]

// Samples are generated on demand, so a purge is modelled as a floor on the
// timestamps a machine is allowed to return.
const historyFloor = new Map<string, number>()

const collector = {
  running: true,
  interval_seconds: 30,
  ticks: 412,
  last_tick_at: now(),
  last_tick_duration_seconds: 0.42,
  machines: {} as Record<
    string,
    { mac: string; success: number; failure: number; last_error: string | null }
  >,
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
    success: 380 + Math.floor(Math.random() * 30),
    failure: 0,
    last_error: null,
  }
}

function serverFor(mac: string): ServerInfo | null {
  if (!cache.populated) return null
  return openstackServers.find((server) => server.mac === mac) ?? null
}

function machineResponse(machine: MachineRow) {
  const openstack = serverFor(machine.mac)
  return { ...machine, openstack, openstack_found: openstack !== null }
}

const MIB = 1024 ** 2
const GIB = 1024 ** 3
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
          used_bytes: Math.round((diskPercent / 100) * diskTotal),
          total_bytes: diskTotal,
          used_percent: round(diskPercent),
        },
        {
          mount: "/var",
          used_bytes: Math.round((varPercent / 100) * varTotal),
          total_bytes: varTotal,
          used_percent: round(varPercent),
        },
      ],
      network: {
        rx_bps: rxBps,
        tx_bps: txBps,
        // Counters as if the interface had been running at this rate for a day.
        rx_bytes: Math.round((rxBps / 8) * 86_400),
        tx_bytes: Math.round((txBps / 8) * 86_400),
        interval_seconds: 15,
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
  const macs = machines.map((machine) => machine.mac)
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

async function readBody(
  req: IncomingMessage
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const raw = Buffer.concat(chunks).toString("utf8")
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
}

function openStream(req: IncomingMessage, res: ServerResponse, macs: string[]) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  })
  res.write(": connected\n\n")
  const metricsTimer = setInterval(() => {
    for (const mac of macs) {
      const payload = JSON.stringify(metricsAt(mac, Date.now()))
      res.write(`event: metrics\ndata: ${payload}\n\n`)
    }
  }, 2000)
  const heartbeatTimer = setInterval(() => res.write(": ping\n\n"), 15_000)
  req.on("close", () => {
    clearInterval(metricsTimer)
    clearInterval(heartbeatTimer)
  })
}

export function mockSnmpApi(): Plugin {
  return {
    name: "mock-snmp-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api", (req, res, next) => {
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
            const known = openstackServers.find((entry) => entry.ipv4 === ipv4)
            if (!known) {
              return json(res, 422, {
                detail: `OpenStack does not know the address ${ipv4 || "(missing)"}`,
              })
            }
            if (machines.some((machine) => machine.mac === known.mac)) {
              return json(res, 409, {
                detail: `Machine ${known.mac} is already registered`,
              })
            }
            const machine: MachineRow = {
              mac: known.mac,
              ipv4: known.ipv4,
              label,
              enabled: true,
              created_at: now(),
              updated_at: now(),
            }
            machines.push(machine)
            collector.machines[machine.mac] = {
              mac: machine.mac,
              success: 0,
              failure: 0,
              last_error: null,
            }
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
            return openStream(req, res, [
              decodeURIComponent(machineStreamMatch[1]),
            ])
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
                .filter((machine) => visibleAt(machine.mac, timeMs))
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
                  samples: Math.max(1, Math.round(step / 30_000)),
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
                samples: visibleAt(machine.mac, timeMs) ? 2880 : 0,
                latest: visibleAt(machine.mac, timeMs)
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
            const step = 30_000
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
            return json(res, 200, collector)
          }

          if (path === "/admin/collector/tick" && method === "POST") {
            collector.ticks += 1
            collector.last_tick_at = now()
            collector.last_tick_duration_seconds = round(
              0.2 + Math.random() * 0.5
            )
            for (const machine of machines) {
              const stat = (collector.machines[machine.mac] ??= {
                mac: machine.mac,
                success: 0,
                failure: 0,
                last_error: null,
              })
              if (!machine.enabled) continue
              if (serverFor(machine.mac) === null) {
                stat.failure += 1
                stat.last_error = "MAC not found in OpenStack"
              } else {
                stat.success += 1
                stat.last_error = null
              }
            }
            const polled = machines.filter((machine) => machine.enabled).length
            return json(res, 200, {
              polled,
              succeeded: polled,
              failed: 0,
              duration_seconds: collector.last_tick_duration_seconds,
            })
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
              servers: cache.populated ? openstackServers.length : 0,
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
            return json(res, 200, openstackServers)
          }

          if (path === "/admin/openstack/cache/flush" && method === "POST") {
            const dropped = cache.populated ? openstackServers.length : 0
            cache.populated = false
            return json(res, 200, { flushed: true, dropped_servers: dropped })
          }

          next()
        }
      })
    },
  }
}
