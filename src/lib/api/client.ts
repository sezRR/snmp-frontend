import { tokenPairSchema } from "@/lib/api/types"
import {
  accessTokenIsFresh,
  clearSession,
  getSession,
  storeTokenPair,
} from "@/lib/auth/session"
import type { z } from "zod"

// Empty base URL targets the page's own origin, which is what a deployment
// behind a reverse proxy wants: the bundle is served from the same host that
// routes the API prefix onward. Set it to reach a backend on another origin,
// which then needs CORS.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ""

/**
 * Path prefix the backend's contract sits under.
 *
 * The API serves everything at the root — `/machines`, not `/api/machines` —
 * so talking to it directly means no prefix at all. In production it sits
 * behind Traefik, which routes `/api` to it off the frontend's own origin, and
 * the frontend has to ask for that prefix. Neither is a property of the API, so
 * it is configuration rather than a constant.
 */
export const API_PREFIX = import.meta.env.VITE_API_PREFIX ?? "/api"

type QueryValue = string | number | boolean | null | undefined
export type QueryParams = Record<string, QueryValue | QueryValue[]>

/** Repeated keys for array values — how FastAPI reads `?mac=a&mac=b`. */
function buildQuery(params?: QueryParams): string {
  if (!params) return ""
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item === undefined || item === null) continue
      search.append(key, String(item))
    }
  }
  const query = search.toString()
  return query ? `?${query}` : ""
}

export function apiUrl(path: string, params?: QueryParams): string {
  return `${API_BASE_URL}${API_PREFIX}${path}${buildQuery(params)}`
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, detail: string) {
    super(detail)
    this.name = "ApiError"
    this.status = status
  }
}

interface ValidationDetail {
  loc?: (string | number)[]
  msg?: string
}

/** FastAPI returns a string detail for HTTPException and a list for 422. */
function readDetail(body: unknown, fallback: string): string {
  if (typeof body !== "object" || body === null) return fallback
  const detail = (body as { detail?: unknown }).detail
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) {
    const messages = (detail as ValidationDetail[])
      .map((issue) => {
        const field = issue.loc?.filter((part) => part !== "body").join(".")
        return field ? `${field}: ${issue.msg ?? "invalid"}` : issue.msg
      })
      .filter(Boolean)
    if (messages.length > 0) return messages.join("; ")
  }
  return fallback
}

// --- Access tokens --------------------------------------------------------

let refreshing: Promise<string | null> | null = null

/**
 * Rotate the refresh token, at most one exchange at a time.
 *
 * The backend revokes the presented refresh token and links it to its
 * successor: presenting one twice looks like a stolen copy and costs the user
 * every session they have. A dashboard fires several requests at once, so the
 * exchange has to be shared rather than raced.
 */
function refreshAccessToken(): Promise<string | null> {
  refreshing ??= exchangeRefreshToken().finally(() => {
    refreshing = null
  })
  return refreshing
}

async function exchangeRefreshToken(): Promise<string | null> {
  const session = getSession()
  if (!session) return null

  let response: Response
  try {
    response = await fetch(apiUrl("/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    })
  } catch {
    // The network is down, not the session. Keeping it means the user is still
    // signed in when connectivity returns.
    return null
  }

  if (!response.ok) {
    // The backend refused the token: revoked, expired or already spent. There
    // is nothing left to authenticate with, so the session goes.
    clearSession()
    return null
  }

  try {
    return storeTokenPair(tokenPairSchema.parse(await response.json()))
      .access_token
  } catch {
    clearSession()
    return null
  }
}

/** The token to send, refreshed first if it is spent or about to be. */
async function currentAccessToken(): Promise<string | null> {
  const session = getSession()
  if (!session) return null
  if (accessTokenIsFresh(session)) return session.access_token
  return refreshAccessToken()
}

// --- Requests -------------------------------------------------------------

interface RequestOptions<T> {
  method?: string
  params?: QueryParams
  body?: unknown
  /** Sent as `application/x-www-form-urlencoded` — what `/auth/login` takes. */
  form?: Record<string, string>
  schema?: z.ZodType<T>
  /** Off for the endpoints that mint credentials rather than consume them. */
  auth?: boolean
}

function send<T>(
  path: string,
  { method = "GET", params, body, form }: RequestOptions<T>,
  token: string | null
): Promise<Response> {
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`

  let payload: string | undefined
  if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded"
    payload = new URLSearchParams(form).toString()
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json"
    payload = JSON.stringify(body)
  }

  return fetch(apiUrl(path, params), { method, headers, body: payload })
}

async function request<T>(
  path: string,
  options: RequestOptions<T> = {}
): Promise<T> {
  const { auth = true, schema } = options

  let response = await send(
    path,
    options,
    auth ? await currentAccessToken() : null
  )

  // A token can be rejected before it looks expired here — the account was
  // deactivated, or the clocks disagree — so one refused request is worth one
  // refresh and one replay before it counts as a failure.
  if (response.status === 401 && auth) {
    const token = await refreshAccessToken()
    if (token) response = await send(path, options, token)
  }

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`
    try {
      detail = readDetail(await response.json(), detail)
    } catch {
      // non-JSON error body; keep the generic message
    }
    throw new ApiError(response.status, detail)
  }

  // 204 on DELETE /machines/{mac} and POST /auth/logout
  if (response.status === 204) return undefined as T

  const payload: unknown = await response.json()
  return schema ? schema.parse(payload) : (payload as T)
}

export const api = {
  get: <T>(
    path: string,
    options?: Omit<RequestOptions<T>, "method" | "body" | "form">
  ) => request<T>(path, options),
  post: <T>(path: string, options?: Omit<RequestOptions<T>, "method">) =>
    request<T>(path, { ...options, method: "POST" }),
  patch: <T>(path: string, options?: Omit<RequestOptions<T>, "method">) =>
    request<T>(path, { ...options, method: "PATCH" }),
  put: <T>(path: string, options?: Omit<RequestOptions<T>, "method">) =>
    request<T>(path, { ...options, method: "PUT" }),
  delete: <T>(path: string, options?: Omit<RequestOptions<T>, "method">) =>
    request<T>(path, { ...options, method: "DELETE" }),
}
