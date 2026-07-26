import { apiUrl } from "./client"

/** One machine's live tail — used by the machine detail page. */
export function machineStreamUrl(mac: string): string {
  return apiUrl(`/machines/${encodeURIComponent(mac)}/metrics/stream`)
}

/**
 * Every machine over a single connection. Dashboards use this instead of one
 * EventSource per card, which browsers cap at six per origin.
 */
export function fleetStreamUrl(macs?: string[]): string {
  return apiUrl("/metrics/stream", macs?.length ? { mac: macs } : undefined)
}
