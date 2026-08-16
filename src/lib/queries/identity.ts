import { api } from "@/lib/api/client"
import {
  type ReplaceRoleScopes,
  type ReplaceUserRoles,
  type ResetUserPassword,
  type RoleCreate,
  type RoleUpdate,
  type UserCreate,
  type UserUpdate,
  roleOutSchema,
  scopeInfoSchema,
  userOutSchema,
} from "@/lib/api/types"
import { SCOPES, useHasScope } from "@/lib/auth/scopes"
import { authQueryKey } from "@/lib/queries/auth"
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { z } from "zod"

const roleListSchema = z.array(roleOutSchema)
const scopeListSchema = z.array(scopeInfoSchema)
const userListSchema = z.array(userOutSchema)

export const rolesQueryKey = ["roles"] as const
export const scopesQueryKey = ["scopes"] as const
export const usersQueryKey = ["users"] as const

export const rolesQueryOptions = () =>
  queryOptions({
    queryKey: rolesQueryKey,
    queryFn: () => api.get("/roles", { schema: roleListSchema }),
    staleTime: 60_000,
  })

export const scopesQueryOptions = () =>
  queryOptions({
    queryKey: scopesQueryKey,
    queryFn: () => api.get("/scopes", { schema: scopeListSchema }),
    staleTime: 60_000,
  })

export const usersQueryOptions = () =>
  queryOptions({
    queryKey: usersQueryKey,
    queryFn: () => api.get("/users", { schema: userListSchema }),
    staleTime: 60_000,
  })

export function useRolesQuery({ enabled = true } = {}) {
  const allowed = useHasScope(SCOPES.rolesRead)
  return useQuery({ ...rolesQueryOptions(), enabled: enabled && allowed })
}

export function useScopesQuery({ enabled = true } = {}) {
  const allowed = useHasScope(SCOPES.rolesRead)
  return useQuery({ ...scopesQueryOptions(), enabled: enabled && allowed })
}

export function useUsersQuery({ enabled = true } = {}) {
  const allowed = useHasScope(SCOPES.usersRead)
  return useQuery({ ...usersQueryOptions(), enabled: enabled && allowed })
}

function useInvalidateRoleIdentity() {
  const queryClient = useQueryClient()
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: rolesQueryKey }),
      queryClient.invalidateQueries({ queryKey: usersQueryKey }),
      queryClient.invalidateQueries({ queryKey: authQueryKey }),
    ])
  }
}

function useInvalidateUserIdentity() {
  const queryClient = useQueryClient()
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: usersQueryKey }),
      queryClient.invalidateQueries({ queryKey: authQueryKey }),
    ])
  }
}

export function useCreateRoleMutation() {
  const invalidate = useInvalidateRoleIdentity()
  return useMutation({
    mutationFn: (body: RoleCreate) =>
      api.post("/roles", { body, schema: roleOutSchema }),
    onSuccess: invalidate,
  })
}

export function useUpdateRoleMutation() {
  const invalidate = useInvalidateRoleIdentity()
  return useMutation({
    mutationFn: ({ name, ...body }: RoleUpdate & { name: string }) =>
      api.patch(`/roles/${encodeURIComponent(name)}`, {
        body,
        schema: roleOutSchema,
      }),
    onSuccess: invalidate,
  })
}

export function useDeleteRoleMutation() {
  const invalidate = useInvalidateRoleIdentity()
  return useMutation({
    mutationFn: (name: string) =>
      api.delete<void>(`/roles/${encodeURIComponent(name)}`),
    onSuccess: invalidate,
  })
}

export function useReplaceRoleScopesMutation() {
  const invalidate = useInvalidateRoleIdentity()
  return useMutation({
    mutationFn: ({ name, ...body }: ReplaceRoleScopes & { name: string }) =>
      api.put(`/roles/${encodeURIComponent(name)}/scopes`, {
        body,
        schema: roleOutSchema,
      }),
    onSuccess: invalidate,
  })
}

export function useCreateUserMutation() {
  const invalidate = useInvalidateUserIdentity()
  return useMutation({
    mutationFn: (body: UserCreate) =>
      api.post("/users", { body, schema: userOutSchema }),
    onSuccess: invalidate,
  })
}

export function useUpdateUserMutation() {
  const invalidate = useInvalidateUserIdentity()
  return useMutation({
    mutationFn: ({ id, ...body }: UserUpdate & { id: string }) =>
      api.patch(`/users/${encodeURIComponent(id)}`, {
        body,
        schema: userOutSchema,
      }),
    onSuccess: invalidate,
  })
}

export function useDeleteUserMutation() {
  const invalidate = useInvalidateUserIdentity()
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<void>(`/users/${encodeURIComponent(id)}`),
    onSuccess: invalidate,
  })
}

export function useReplaceUserRolesMutation() {
  const invalidate = useInvalidateUserIdentity()
  return useMutation({
    mutationFn: ({ id, ...body }: ReplaceUserRoles & { id: string }) =>
      api.put(`/users/${encodeURIComponent(id)}/roles`, {
        body,
        schema: userOutSchema,
      }),
    onSuccess: invalidate,
  })
}

export function useResetUserPasswordMutation() {
  const invalidate = useInvalidateUserIdentity()
  return useMutation({
    mutationFn: ({ id, ...body }: ResetUserPassword & { id: string }) =>
      api.put<void>(`/users/${encodeURIComponent(id)}/password`, { body }),
    onSuccess: invalidate,
  })
}
