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
  if (used === null && total === null) return "n/a"
  if (total === null) return formatBytes(used ?? 0)
  if (used === null) return `n/a / ${formatBytes(total)}`
  return `${formatBytes(used)} / ${formatBytes(total)}`
}

/**
 * Disk throughput. The collector counts disk IO in bytes, not bits like the
 * network counters, so this stays in binary byte units rather than reusing
 * `formatBps`.
 */
export function formatBytesRate(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`
}

/** Operation rates: "1.2k IO/s", small values kept whole. */
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

/**
 * Absolute timestamps, always on a 24-hour clock.
 *
 * The locale still decides field order and separators, but not the clock: an
 * operator correlating a chart tick with a log line should not have to decode
 * AM/PM, and 13:05 is unambiguous in every locale this runs in.
 */
export function formatDateTime(value: string | number | Date): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
    hour12: false,
  })
}

/**
 * A timestamp the collector stamped, shown as-is.
 *
 * There is deliberately no "N seconds ago" anywhere in this app. Elapsed time
 * is the browser's clock minus a machine's, and the machines this polls do not
 * all keep NTP — one whose RTC is set to local time and read as UTC would
 * report samples "in 3 hours", and one drifting the other way would look dead.
 * An absolute timestamp is a fact the sender recorded; a relative one is a
 * subtraction between two clocks that disagree.
 */
export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "n/a"
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? formatDateTime(parsed) : "n/a"
}

/** A configured period — a duration, not a point on anyone's clock. */
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
