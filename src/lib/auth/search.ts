import { z } from "zod"

const RETURN_TO_ORIGIN = "https://return-to.invalid"

/**
 * Where a guard turned the visitor away from, to be resumed once they can go
 * there. Shared by /login and /unauthorized so the rule is written once.
 *
 * Only a path on this origin survives: an absolute URL would turn either page
 * into an open redirect, and `//host` (or `/\host`) is a protocol-relative URL
 * wearing a path's clothes.
 *
 * The guard pages themselves are dropped too. They never make sense as a place
 * to come back to, and letting one through lets a redirect nest inside its own
 * return URL, one encoding layer per pass.
 */
export function sanitizeReturnTo(value?: string): string | undefined {
  if (!value?.startsWith("/")) return undefined

  let target: URL
  try {
    target = new URL(value, RETURN_TO_ORIGIN)
  } catch {
    return undefined
  }

  if (target.origin !== RETURN_TO_ORIGIN) return undefined
  if (target.pathname.startsWith("//")) return undefined

  let decodedPathname: string
  try {
    decodedPathname = decodeURI(target.pathname)
  } catch {
    return undefined
  }

  if (/^\/(?:login|unauthorized)(?:\/|$)/i.test(decodedPathname)) {
    return undefined
  }

  return `${target.pathname}${target.search}${target.hash}`
}

export const returnToSchema = z.string().optional().transform(sanitizeReturnTo)
