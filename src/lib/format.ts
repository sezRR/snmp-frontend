export function formatBps(bps: number): string {
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(1)} Gbps`
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} Mbps`
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(1)} Kbps`
  return `${Math.round(bps)} bps`
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
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
