export function formatBps(bps: number): string {
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(1)} Gbps`
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} Mbps`
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(1)} Kbps`
  return `${Math.round(bps)} bps`
}

const BYTE_UNITS = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"] as const

/** Binary units, matching how the agent and OpenStack flavors count memory. */
export function formatBytes(bytes: number, digits = 1): string {
  let value = Math.abs(bytes)
  let unit = 0
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024
    unit += 1
  }
  const sign = bytes < 0 ? "-" : ""
  return `${sign}${value.toFixed(unit === 0 ? 0 : digits)} ${BYTE_UNITS[unit]}`
}

/** "10.5 GiB / 16.0 GiB" — used against a limit, the em dash when unknown. */
export function formatUsage(used: number | null, total: number | null): string {
  if (used === null && total === null) return "—"
  if (total === null) return formatBytes(used ?? 0)
  if (used === null) return `— / ${formatBytes(total)}`
  return `${formatBytes(used)} / ${formatBytes(total)}`
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat().format(value)
}

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
})

export function formatRelativeTime(iso: string): string {
  const deltaSeconds = (new Date(iso).getTime() - Date.now()) / 1000
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ]
  for (const [unit, seconds] of units) {
    if (Math.abs(deltaSeconds) >= seconds) {
      return relativeFormatter.format(Math.round(deltaSeconds / seconds), unit)
    }
  }
  return relativeFormatter.format(Math.round(deltaSeconds), "second")
}

export function formatDuration(seconds: number): string {
  if (seconds < 1) return `${Math.round(seconds * 1000)} ms`
  if (seconds < 60) return `${seconds.toFixed(1)} s`
  return `${Math.round(seconds / 60)} min`
}

/** Machines are addressed by MAC; short form keeps sidebar rows readable. */
export function shortMac(mac: string): string {
  const parts = mac.split(":")
  return parts.length > 3 ? parts.slice(-3).join(":") : mac
}
