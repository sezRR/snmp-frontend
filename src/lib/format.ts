export function formatBps(bps: number): string {
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(1)} Gbps`
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} Mbps`
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(1)} Kbps`
  return `${Math.round(bps)} bps`
}

const BYTE_UNITS = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"] as const

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

export function formatUsage(used: number | null, total: number | null): string {
  if (used === null && total === null) return "n/a"
  if (total === null) return formatBytes(used ?? 0)
  if (used === null) return `n/a / ${formatBytes(total)}`
  return `${formatBytes(used)} / ${formatBytes(total)}`
}

export function formatBytesRate(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`
}

export function formatIops(value: number): string {
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k IO/s`
  return `${value.toFixed(value >= 100 ? 0 : 1)} IO/s`
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat().format(value)
}

export function formatDateTime(value: string | number | Date): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
    hour12: false,
  })
}

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "n/a"
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? formatDateTime(parsed) : "n/a"
}

export function formatDuration(seconds: number): string {
  if (seconds < 1) return `${Math.round(seconds * 1000)} ms`
  if (seconds < 60) return `${seconds.toFixed(1)} s`
  return `${Math.round(seconds / 60)} min`
}

export function shortMac(mac: string): string {
  const parts = mac.split(":")
  return parts.length > 3 ? parts.slice(-3).join(":") : mac
}
