import { fetchStreamTicket } from "@/lib/queries/auth"

import { apiUrl } from "./client"

// EventSource cannot send an Authorization header, so both stream endpoints
// accept a single-use ticket as a query parameter instead. A ticket is spent by
// the connection it opens, which is why these are functions called per connect
// rather than URLs computed once.

/** One machine's live tail — used by the machine detail page. */
export async function machineStreamUrl(mac: string): Promise<string> {
  return apiUrl(`/machines/${encodeURIComponent(mac)}/metrics/stream`, {
    ticket: await fetchStreamTicket(),
  })
}

/**
 * Every machine over a single connection. Dashboards use this instead of one
 * EventSource per card, which browsers cap at six per origin.
 */
export async function fleetStreamUrl(macs?: string[]): Promise<string> {
  return apiUrl("/metrics/stream", {
    ...(macs?.length ? { mac: macs } : {}),
    ticket: await fetchStreamTicket(),
  })
}
