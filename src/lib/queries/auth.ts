import { api } from "@/lib/api/client"
import {
  type LoginBody,
  meSchema,
  streamTicketSchema,
  tokenPairSchema,
} from "@/lib/api/types"
import { clearSession, getSession, storeTokenPair } from "@/lib/auth/session"
import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

export const authQueryKey = ["auth"] as const

/**
 * The signed-in account, its roles and its effective scopes.
 *
 * Read from the backend rather than decoded from the token, because the token
 * carries whatever was true when it was issued and a role change lands here on
 * the next fetch. Not retried: the only interesting failure is a 401, and the
 * request layer has already tried a refresh by then.
 */
export const meQueryOptions = () =>
  queryOptions({
    queryKey: [...authQueryKey, "me"] as const,
    queryFn: () => api.get("/auth/me", { schema: meSchema }),
    staleTime: 300_000,
    retry: false,
  })

/**
 * A single-use credential for `EventSource`, which cannot send an
 * Authorization header. Worth one connection and a few seconds, so every
 * reconnect has to mint its own.
 */
export async function fetchStreamTicket(): Promise<string> {
  const { ticket } = await api.post("/auth/stream-ticket", {
    schema: streamTicketSchema,
  })
  return ticket
}

export function useLoginMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ username, password }: LoginBody) => {
      const pair = await api.post("/auth/login", {
        // OAuth2 password flow: form-encoded, not JSON.
        form: { grant_type: "password", username, password },
        auth: false,
        schema: tokenPairSchema,
      })
      storeTokenPair(pair)
      return pair
    },
    // Whatever the previous session cached was answered for a different set of
    // scopes, and possibly a different user.
    onSuccess: () => queryClient.clear(),
  })
}

export function useLogoutMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const session = getSession()
      // Revoking the refresh token is what actually ends the session server
      // side; the access token stays valid for its last few minutes, which
      // nothing can recall. A failure here still signs this browser out.
      if (session) {
        try {
          await api.post<void>("/auth/logout", {
            body: { refresh_token: session.refresh_token },
          })
        } catch {
          // already revoked, or the backend is unreachable
        }
      }
    },
    onSettled: () => {
      clearSession()
      queryClient.clear()
    },
  })
}

/**
 * Change your own password. The backend ends every other session and hands
 * back a fresh pair, so the tab that made the change stays signed in.
 */
export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: async (body: {
      current_password: string
      new_password: string
    }) => {
      const pair = await api.patch("/auth/me/password", {
        body,
        schema: tokenPairSchema,
      })
      storeTokenPair(pair)
      return pair
    },
  })
}
