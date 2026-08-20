import type { AccessRule } from "@/lib/auth/rbac"
import { SCOPES } from "@/lib/auth/scopes"

// What each guarded area demands, written once. The route guard that turns a
// visitor away and the sidebar item that would have sent them there read the
// same rule, so a permission cannot be tightened in one place and left loose in
// the other — and a link is never offered to a page that would refuse it.

/** Reading the collector, the cache and the credential store. */
export const ADMIN_ACCESS = {
  scopes: [SCOPES.adminRead],
} satisfies AccessRule

/** The account list and everything done to an account. */
export const USERS_ACCESS = {
  scopes: [SCOPES.usersRead],
} satisfies AccessRule

/** The role list and the scopes each role grants. */
export const ROLES_ACCESS = {
  scopes: [SCOPES.rolesRead],
} satisfies AccessRule

/**
 * The administration console as a whole — the pathless `_console` layout.
 *
 * Deliberately the *union* of its pages rather than the intersection: holding
 * `users:read` alone is a good enough reason to be inside the console, and the
 * page underneath still applies its own rule. The layout only keeps a user with
 * no business here at all from loading any of it.
 */
export const CONSOLE_ACCESS = {
  scopes: [SCOPES.adminRead, SCOPES.usersRead, SCOPES.rolesRead],
} satisfies AccessRule
