import type { TokenPair } from "@/lib/api/types"
import { createLocalStore, useLocalStore } from "@/lib/local-store"
import { z } from "zod"

// The signed-in session: an access token, the refresh token that renews it,
// and when the access token stops being accepted.
//
// It lives in localStorage because the backend hands the pair to the client in
// a JSON body — there is no cookie to ride on — and because a page reload must
// not sign the user out. That also means every tab shares one session, which is
// what makes the cross-tab handling in createLocalStore worth having here: a
// logout in one tab clears the others on the next read.

const sessionSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  /** Absolute epoch ms, computed from `expires_in` when the pair arrived. */
  access_expires_at: z.number(),
})

export type Session = z.infer<typeof sessionSchema>

const sessionStore = createLocalStore<Session | null>(
  "snmp.session",
  null,
  sessionSchema.nullable()
)

/**
 * Renewed this many ms before the access token actually expires.
 *
 * The client's clock is its own; a small lead means a token that is already
 * dead on the server is refreshed rather than spent on a request that would
 * come back 401 and have to be replayed.
 */
const EXPIRY_SKEW_MS = 15_000

export const getSession = sessionStore.get

export function useSession(): Session | null {
  return useLocalStore(sessionStore)
}

/** Whether a session exists at all — the router's cheap pre-flight check. */
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

/** True while the access token is still worth sending. */
export function accessTokenIsFresh(session: Session): boolean {
  return session.access_expires_at - EXPIRY_SKEW_MS > Date.now()
}
