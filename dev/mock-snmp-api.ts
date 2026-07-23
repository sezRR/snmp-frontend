import type { IncomingMessage, ServerResponse } from "node:http"
import type { Plugin } from "vite"

// Dev-only stand-in for the FastAPI backend. Serves the same /api/v1/snmp
// contract (REST + SSE) so the UI is fully exercisable before the real
// backend exists. Requests bypass it entirely once VITE_API_BASE_URL points
// at a real origin.

interface MockWorker {
  id: string
  ip: string
  name: string | null
  snmp_version: "v2c" | "v3"
  status: "up" | "down" | "unknown"
  created_at: string
  last_seen_at: string | null
}

const workers: MockWorker[] = [
  {
    id: "wkr_demo01",
    ip: "192.168.1.10",
    name: "core-switch-01",
    snmp_version: "v2c",
    status: "up",
    created_at: new Date(Date.now() - 86_400_000).toISOString(),
    last_seen_at: new Date().toISOString(),
  },
]
let nextWorker = 2

// Deterministic per-worker pseudo-metrics: smooth sinusoids + jitter.
function metricsAt(workerId: string, timeMs: number) {
  const seed = [...workerId].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  const t = timeMs / 60_000
  const wave = (period: number, phase: number) =>
    (Math.sin((t / period) * 2 * Math.PI + seed + phase) + 1) / 2
  const jitter = () => Math.random() * 6 - 3
  return {
    worker_id: workerId,
    ts: new Date(timeMs).toISOString(),
    cpu_percent: clamp(20 + wave(17, 0) * 55 + jitter(), 1, 99),
    ram_percent: clamp(45 + wave(43, 2) * 30 + jitter(), 5, 98),
    bandwidth_in_bps: Math.round(
      (30 + wave(11, 4) * 400) * 1e6 * (1 + Math.random() * 0.1)
    ),
    bandwidth_out_bps: Math.round(
      (5 + wave(13, 1) * 60) * 1e6 * (1 + Math.random() * 0.1)
    ),
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number(value.toFixed(1))))
}

const INTERVAL_MS: Record<string, number> = {
  "30s": 30_000,
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
  "6h": 21_600_000,
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" })
  res.end(JSON.stringify(body))
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return JSON.parse(Buffer.concat(chunks).toString("utf8"))
}

export function mockSnmpApi(): Plugin {
  return {
    name: "mock-snmp-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/v1/snmp", (req, res, next) => {
        void handle(req, res).catch(() =>
          json(res, 500, { detail: "Mock API error" })
        )

        async function handle(req: IncomingMessage, res: ServerResponse) {
          const url = new URL(req.url ?? "/", "http://localhost")
          const path = url.pathname

          if (path === "/workers" && req.method === "GET") {
            return json(res, 200, workers)
          }

          if (path === "/workers" && req.method === "POST") {
            const body = (await readBody(req)) as {
              ip?: string
              name?: string
              snmp_version?: "v2c" | "v3"
            }
            if (!body.ip || !body.snmp_version) {
              return json(res, 422, {
                detail: "ip and snmp_version are required",
              })
            }
            if (workers.some((w) => w.ip === body.ip)) {
              return json(res, 409, {
                detail: `Worker with IP ${body.ip} already exists`,
              })
            }
            const worker: MockWorker = {
              id: `wkr_mock${String(nextWorker++).padStart(2, "0")}`,
              ip: body.ip,
              name: body.name ?? null,
              snmp_version: body.snmp_version,
              status: "up",
              created_at: new Date().toISOString(),
              last_seen_at: new Date().toISOString(),
            }
            workers.push(worker)
            return json(res, 201, worker)
          }

          if (path === "/metrics" && req.method === "GET") {
            const workerId = url.searchParams.get("worker_id")
            const start = Date.parse(url.searchParams.get("start") ?? "")
            const end = Date.parse(url.searchParams.get("end") ?? "")
            const interval = url.searchParams.get("interval") ?? "1m"
            if (!workerId || Number.isNaN(start) || Number.isNaN(end)) {
              return json(res, 422, {
                detail: "worker_id, start and end are required",
              })
            }
            const stepMs = INTERVAL_MS[interval] ?? 60_000
            const points = []
            for (let ts = start; ts <= end; ts += stepMs) {
              const m = metricsAt(workerId, ts)
              points.push({
                ts: m.ts,
                cpu_percent: m.cpu_percent,
                ram_percent: m.ram_percent,
                bandwidth_in_bps: m.bandwidth_in_bps,
                bandwidth_out_bps: m.bandwidth_out_bps,
              })
            }
            return json(res, 200, { worker_id: workerId, interval, points })
          }

          const liveMatch = /^\/worker\/([^/]+)\/live$/.exec(path)
          if (liveMatch && req.method === "GET") {
            const workerId = liveMatch[1]
            res.writeHead(200, {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            })
            res.write(`: connected\n\n`)
            const metricsTimer = setInterval(() => {
              const payload = JSON.stringify(metricsAt(workerId, Date.now()))
              res.write(`event: metrics\ndata: ${payload}\n\n`)
            }, 2000)
            const heartbeatTimer = setInterval(() => {
              res.write(`: ping\n\n`)
            }, 15_000)
            req.on("close", () => {
              clearInterval(metricsTimer)
              clearInterval(heartbeatTimer)
            })
            return
          }

          next()
        }
      })
    },
  }
}
