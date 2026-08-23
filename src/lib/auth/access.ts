import type { AccessRule } from "@/lib/auth/rbac"
import { SCOPES } from "@/lib/auth/scopes"

export const ADMIN_ACCESS = {
  scopes: [SCOPES.adminRead],
} satisfies AccessRule

export const USERS_ACCESS = {
  scopes: [SCOPES.usersRead],
} satisfies AccessRule

export const ROLES_ACCESS = {
  scopes: [SCOPES.rolesRead],
} satisfies AccessRule

export const CONSOLE_ACCESS = {
  scopes: [SCOPES.adminRead, SCOPES.usersRead, SCOPES.rolesRead],
} satisfies AccessRule
