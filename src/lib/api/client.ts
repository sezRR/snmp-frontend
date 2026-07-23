// Empty base URL targets the Vite dev server, where the mock API middleware
// (or a configured proxy) answers /api/* requests on the same origin.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ""

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, detail: string) {
    super(detail)
    this.name = "ApiError"
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  })

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`
    try {
      const body = (await response.json()) as { detail?: unknown }
      if (typeof body.detail === "string") detail = body.detail
    } catch {
      // non-JSON error body; keep the generic message
    }
    throw new ApiError(response.status, detail)
  }

  return response.json() as Promise<T>
}

export const api = {
  get: <T>(path: string, params?: Record<string, string>): Promise<T> => {
    const query = params ? `?${new URLSearchParams(params)}` : ""
    return request<T>(`${path}${query}`)
  },
  post: <T>(path: string, body: unknown): Promise<T> =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
}
