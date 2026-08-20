// The permission vocabulary, fixed in the backend's code and served by
// /scopes. Naming it here keeps a typo in a gate from silently hiding a button
// forever, since an unknown string would never be held by anyone.
//
// This module is deliberately data only — no hooks, no queries — so that the
// router context, the route guards and the components can all name the same
// permissions without importing each other. Who holds them is `auth/rbac`.

export const SCOPES = {
  machinesRead: "machines:read",
  machinesWrite: "machines:write",
  metricsRead: "metrics:read",
  metricsWrite: "metrics:write",
  adminRead: "admin:read",
  adminWrite: "admin:write",
  usersRead: "users:read",
  usersWrite: "users:write",
  rolesRead: "roles:read",
  rolesWrite: "roles:write",
  credentialsRead: "credentials:read",
  credentialsWrite: "credentials:write",
} as const

export type Scope = (typeof SCOPES)[keyof typeof SCOPES]

/**
 * The roles the backend ships with. Unlike scopes these are *data*: /roles is a
 * CRUD page, so an operator can invent "night-shift" tomorrow and a gate that
 * insisted on this union would refuse to compile against their own fleet. Hence
 * a plain string everywhere a role is asked for, and this object only as the
 * spelling of the three that are always there.
 *
 * Prefer gating on a scope. A role is the right question only when the rule is
 * about *who someone is* rather than what they may do — the scopes a role holds
 * can be edited out from under it, its name cannot.
 */
export const ROLES = {
  admin: "admin",
  operator: "operator",
  viewer: "viewer",
} as const
