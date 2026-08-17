import { apiUrl } from "@/lib/api/client"
import {
  confirmUnreachable,
  reportReachable,
  useReachability,
} from "@/lib/api/reachability"
import { queryOptions, useQuery } from "@tanstack/react-query"

/**
 * `GET /healthz` — the one endpoint that needs neither a token nor a working
 * database behind it, which makes it the only honest answer to "is the API
 * there?".
 *
 * Deliberately not routed through `api.get`: that layer insists on a JSON body
 * and would turn a liveness probe answering `ok` in plain text into a failure.
 * Here the status line is the whole verdict and the body is a courtesy.
 */

export interface BackendHealth {
  /** Whatever the body called itself, when it says so. */
  status: string
}

const HEALTH_PATH = "/healthz"

/**
 * The URL the probe asks. Worth showing on the failure screen: it is assembled
 * from `VITE_API_BASE_URL` and `VITE_API_PREFIX`, so a deployment pointed at
 * the wrong host looks exactly like a backend that is down until you see it.
 */
export const healthEndpoint = (): string => apiUrl(HEALTH_PATH)

export class BackendUnreachableError extends Error {
  /** The response status, or 0 when nothing answered at all. */
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
    // DNS, TLS, a refused connection, or the browser being offline. The failure
    // reason is deliberately not surfaced: `fetch` reports all of them as the
    // same opaque `TypeError` and the message varies per browser.
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

  // A body is optional and its shape is not part of the contract, so it is read
  // for the label only and never for the verdict.
  let status = "ok"
  try {
    const body: unknown = await response.json()
    if (typeof body === "object" && body !== null) {
      const reported = (body as { status?: unknown }).status
      if (typeof reported === "string" && reported) status = reported
    }
  } catch {
    // not JSON; the 2xx already said everything that matters
  }

  return { status }
}

export const healthQueryKey = ["health"] as const

export const healthQueryOptions = () =>
  queryOptions({
    queryKey: healthQueryKey,
    queryFn: probeHealth,
    // A liveness answer is worthless the moment after it arrives, and one
    // failure is the answer rather than something to retry past.
    staleTime: 0,
    retry: false,
  })

/** How often to knock while nobody is answering. */
const RECHECK_MS = 5_000

/**
 * The probe, run once on mount and then on a loop for as long as the request
 * layer has anything to be suspicious about. Polling stops the moment the API
 * answers again, because every other query in the app is already evidence.
 */
export function useBackendHealth() {
  const reachability = useReachability()

  return useQuery({
    ...healthQueryOptions(),
    refetchInterval: reachability === "ok" ? false : RECHECK_MS,
    // A backgrounded tab does not need to keep knocking, but a user coming back
    // to one wants the answer already refreshed.
    refetchIntervalInBackground: false,
  })
}
