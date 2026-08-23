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

export const meQueryOptions = () =>
  queryOptions({
    queryKey: [...authQueryKey, "me"] as const,
    queryFn: () => api.get("/auth/me", { schema: meSchema }),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: "always",
    retry: false,
  })

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
        form: { grant_type: "password", username, password },
        auth: false,
        schema: tokenPairSchema,
      })
      storeTokenPair(pair)
      return pair
    },
    onSuccess: () => queryClient.clear(),
  })
}

export function useLogoutMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const session = getSession()
      if (session) {
        try {
          await api.post<void>("/auth/logout", {
            body: { refresh_token: session.refresh_token },
          })
        } catch {
        }
      }
    },
    onSettled: () => {
      clearSession()
      queryClient.clear()
    },
  })
}

export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: async (body: {
      current_password: string
      new_password: string
    }) => {
      const pair = await api.patch("/auth/me/password", {
        body,
        schema: tokenPairSchema,
        sessionCritical: false,
      })
      storeTokenPair(pair)
      return pair
    },
  })
}
