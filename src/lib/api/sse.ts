import { API_BASE_URL } from "./client"

export function buildLiveUrl(workerId: string): string {
  return `${API_BASE_URL}/api/v1/snmp/worker/${workerId}/live`
}
