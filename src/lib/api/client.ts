import { reportResponseStatus, reportUnreachable } from "@/lib/api/reachability"
import { tokenPairSchema } from "@/lib/api/types"
import {
  accessTokenIsFresh,
  clearSession,
  getSession,
  storeTokenPair,
} from "@/lib/auth/session"
import type { z } from "zod"

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ""

export const API_PREFIX = import.meta.env.VITE_API_PREFIX ?? "/api"

type QueryValue = string | number | boolean | null | undefined
export type QueryParams = Record<string, QueryValue | QueryValue[]>

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

let refreshing: Promise<string | null> | null = null

function refreshAccessToken(): Promise<string | null> {
  refreshing ??= exchangeRefreshToken().finally(() => {
    refreshing = null
  })
  return refreshing
}

function isTokenRefusal(status: number): boolean {
  return status >= 400 && status < 500 && status !== 408 && status !== 429
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
    reportResponseStatus(response.status)
  } catch {
    reportUnreachable()
    return null
  }

  if (!response.ok) {
    if (isTokenRefusal(response.status)) clearSession()
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

async function currentAccessToken(): Promise<string | null> {
  const session = getSession()
  if (!session) return null
  if (accessTokenIsFresh(session)) return session.access_token
  return refreshAccessToken()
}

interface RequestOptions<T> {
  method?: string
  params?: QueryParams
  body?: unknown
  form?: Record<string, string>
  schema?: z.ZodType<T>
  auth?: boolean
  sessionCritical?: boolean
}

export interface ApiResponse<T> {
  data: T
  response: Response
}

async function send<T>(
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

  try {
    const response = await fetch(apiUrl(path, params), {
      method,
      headers,
      body: payload,
    })
    reportResponseStatus(response.status)
    return response
  } catch (error) {
    reportUnreachable()
    throw error
  }
}

async function requestWithResponse<T>(
  path: string,
  options: RequestOptions<T> = {}
): Promise<ApiResponse<T>> {
  const { auth = true, schema, sessionCritical = true } = options

  let response = await send(
    path,
    options,
    auth ? await currentAccessToken() : null
  )

  if (response.status === 401 && auth) {
    const token = await refreshAccessToken()
    if (token) {
      response = await send(path, options, token)
      if (response.status === 401 && sessionCritical) clearSession()
    }
  }

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`
    try {
      detail = readDetail(await response.json(), detail)
    } catch {
    }
    throw new ApiError(response.status, detail)
  }

  if (response.status === 204) {
    return { data: undefined as T, response }
  }

  const payload: unknown = await response.json()
  return {
    data: schema ? schema.parse(payload) : (payload as T),
    response,
  }
}

async function request<T>(
  path: string,
  options: RequestOptions<T> = {}
): Promise<T> {
  return (await requestWithResponse(path, options)).data
}

export const api = {
  get: <T>(
    path: string,
    options?: Omit<RequestOptions<T>, "method" | "body" | "form">
  ) => request<T>(path, options),
  getWithResponse: <T>(
    path: string,
    options?: Omit<RequestOptions<T>, "method" | "body" | "form">
  ) => requestWithResponse<T>(path, options),
  post: <T>(path: string, options?: Omit<RequestOptions<T>, "method">) =>
    request<T>(path, { ...options, method: "POST" }),
  patch: <T>(path: string, options?: Omit<RequestOptions<T>, "method">) =>
    request<T>(path, { ...options, method: "PATCH" }),
  put: <T>(path: string, options?: Omit<RequestOptions<T>, "method">) =>
    request<T>(path, { ...options, method: "PUT" }),
  delete: <T>(path: string, options?: Omit<RequestOptions<T>, "method">) =>
    request<T>(path, { ...options, method: "DELETE" }),
}
