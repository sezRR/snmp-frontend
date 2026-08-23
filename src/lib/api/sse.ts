import { fetchStreamTicket } from "@/lib/queries/auth"

import { apiUrl } from "./client"

export async function machineStreamUrl(mac: string): Promise<string> {
  return apiUrl(`/machines/${encodeURIComponent(mac)}/metrics/stream`, {
    ticket: await fetchStreamTicket(),
  })
}

export async function fleetStreamUrl(macs?: string[]): Promise<string> {
  return apiUrl("/metrics/stream", {
    ...(macs?.length ? { mac: macs } : {}),
    ticket: await fetchStreamTicket(),
  })
}
