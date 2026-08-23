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

export const ROLES = {
  admin: "admin",
  operator: "operator",
  viewer: "viewer",
} as const
