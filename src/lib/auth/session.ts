import type { TokenPair } from "@/lib/api/types"
import { createLocalStore, useLocalStore } from "@/lib/local-store"
import { z } from "zod"

const sessionSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  access_expires_at: z.number(),
})

export type Session = z.infer<typeof sessionSchema>

const sessionStore = createLocalStore<Session | null>(
  "snmp.session",
  null,
  sessionSchema.nullable()
)

const EXPIRY_SKEW_MS = 15_000

export const getSession = sessionStore.get

export function useSession(): Session | null {
  return useLocalStore(sessionStore)
}

export function hasSession(): boolean {
  return sessionStore.get() !== null
}

export function storeTokenPair(pair: TokenPair): Session {
  const session: Session = {
    access_token: pair.access_token,
    refresh_token: pair.refresh_token,
    access_expires_at: Date.now() + pair.expires_in * 1000,
  }
  sessionStore.set(session)
  return session
}

export function clearSession(): void {
  sessionStore.set(null)
}

export function accessTokenIsFresh(session: Session): boolean {
  return session.access_expires_at - EXPIRY_SKEW_MS > Date.now()
}
