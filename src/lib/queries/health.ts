import { apiUrl } from "@/lib/api/client"
import {
  confirmUnreachable,
  reportReachable,
  useReachability,
} from "@/lib/api/reachability"
import { queryOptions, useQuery } from "@tanstack/react-query"

export interface BackendHealth {
  status: string
}

const HEALTH_PATH = "/healthz"

export const healthEndpoint = (): string => apiUrl(HEALTH_PATH)

export class BackendUnreachableError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "BackendUnreachableError"
    this.status = status
  }
}

async function probeHealth(): Promise<BackendHealth> {
  let response: Response
  try {
    response = await fetch(healthEndpoint(), {
      headers: { Accept: "application/json" },
    })
  } catch {
    confirmUnreachable()
    throw new BackendUnreachableError(0, "No answer from the API.")
  }

  if (!response.ok) {
    confirmUnreachable()
    throw new BackendUnreachableError(
      response.status,
      `The API answered ${response.status} to its own health check.`
    )
  }

  reportReachable()

  let status = "ok"
  try {
    const body: unknown = await response.json()
    if (typeof body === "object" && body !== null) {
      const reported = (body as { status?: unknown }).status
      if (typeof reported === "string" && reported) status = reported
    }
  } catch {
  }

  return { status }
}

export const healthQueryKey = ["health"] as const

export const healthQueryOptions = () =>
  queryOptions({
    queryKey: healthQueryKey,
    queryFn: probeHealth,
    staleTime: 0,
    retry: false,
  })

const RECHECK_MS = 5_000

export function useBackendHealth() {
  const reachability = useReachability()

  return useQuery({
    ...healthQueryOptions(),
    refetchInterval: reachability === "ok" ? false : RECHECK_MS,
    refetchIntervalInBackground: false,
  })
}
