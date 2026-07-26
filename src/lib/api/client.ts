import type { z } from "zod"

// Empty base URL targets the Vite dev server, where the mock API middleware
// (or a configured proxy) answers /api/* requests on the same origin. The
// backend's OpenAPI document mounts everything under /api.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ""
export const API_PREFIX = "/api"

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

interface RequestOptions<T> {
  method?: string
  params?: QueryParams
  body?: unknown
  schema?: z.ZodType<T>
}

async function request<T>(
  path: string,
  { method = "GET", params, body, schema }: RequestOptions<T> = {}
): Promise<T> {
  const response = await fetch(apiUrl(path, params), {
    method,
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`
    try {
      detail = readDetail(await response.json(), detail)
    } catch {
      // non-JSON error body; keep the generic message
    }
    throw new ApiError(response.status, detail)
  }

  // 204 on DELETE /machines/{mac}
  if (response.status === 204) return undefined as T

  const payload: unknown = await response.json()
  return schema ? schema.parse(payload) : (payload as T)
}

export const api = {
  get: <T>(
    path: string,
    options?: Omit<RequestOptions<T>, "method" | "body">
  ) => request<T>(path, options),
  post: <T>(path: string, options?: Omit<RequestOptions<T>, "method">) =>
    request<T>(path, { ...options, method: "POST" }),
  patch: <T>(path: string, options?: Omit<RequestOptions<T>, "method">) =>
    request<T>(path, { ...options, method: "PATCH" }),
  delete: <T>(path: string, options?: Omit<RequestOptions<T>, "method">) =>
    request<T>(path, { ...options, method: "DELETE" }),
}
