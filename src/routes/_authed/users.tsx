import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/client"
import type { RoleOut as Role, UserOut as User } from "@/lib/api/types"
import { requireRouteScope } from "@/lib/auth/route-guards"
import { SCOPES, useHasScope } from "@/lib/auth/scopes"
import { meQueryOptions } from "@/lib/queries/auth"
import {
  useCreateUserMutation,
  useDeleteUserMutation,
  useReplaceUserRolesMutation,
  useResetUserPasswordMutation,
  useRolesQuery,
  useUpdateUserMutation,
  useUsersQuery,
} from "@/lib/queries/identity"
import { useQuery } from "@tanstack/react-query"
import { Navigate, createFileRoute } from "@tanstack/react-router"
import {
  KeyRound,
  Plus,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  UsersRound,
} from "lucide-react"
import * as React from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/_authed/users")({
  beforeLoad: ({ context, location }) =>
    requireRouteScope(context.queryClient, SCOPES.usersRead, location.href),
  component: UsersPage,
})

type UserAction = "roles" | "status" | "password" | "delete"

interface SelectedAction {
  type: UserAction
  user: User
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

function UsersPage() {
  const canRead = useHasScope(SCOPES.usersRead)
  const canWrite = useHasScope(SCOPES.usersWrite)
  const canReadRoles = useHasScope(SCOPES.rolesRead)
  const { data: me } = useQuery(meQueryOptions())
  const usersQuery = useUsersQuery()
  const rolesQuery = useRolesQuery({ enabled: canReadRoles })

  const [creating, setCreating] = React.useState(false)
  const [selectedAction, setSelectedAction] =
    React.useState<SelectedAction | null>(null)

  const users = usersQuery.data
  const selectedUser = selectedAction
    ? (users?.find((user) => user.id === selectedAction.user.id) ??
      selectedAction.user)
    : null

  if (!canRead) return <Navigate to="/" replace />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold">Users</h1>
        {!canWrite ? <Badge variant="outline">Read only</Badge> : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User accounts</CardTitle>
          <CardDescription>
            {canWrite
              ? "Manage account access, roles, and credentials."
              : "You can inspect accounts, but users:write is required to change them."}
          </CardDescription>
          {canWrite ? (
            <CardAction>
              <Button onClick={() => setCreating(true)}>
                <Plus data-icon="inline-start" />
                Create user
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent>
          {usersQuery.isPending ? <UsersSkeleton /> : null}

          {usersQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Users could not be loaded</AlertTitle>
              <AlertDescription>
                {errorMessage(usersQuery.error, "Could not reach the API.")}
              </AlertDescription>
              <AlertAction>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void usersQuery.refetch()}
                >
                  Try again
                </Button>
              </AlertAction>
            </Alert>
          ) : null}

          {users && users.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UsersRound />
                </EmptyMedia>
                <EmptyTitle>No users found</EmptyTitle>
                <EmptyDescription>
                  {canWrite
                    ? "Create the first account to add it here."
                    : "There are no accounts available to inspect."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}

          {users && users.length > 0 ? (
            <div className="flex flex-col">
              {users.map((user, index) => (
                <React.Fragment key={user.id}>
                  {index > 0 ? <Separator /> : null}
                  <UserRow
                    user={user}
                    current={me?.id === user.id}
                    canWrite={canWrite}
                    canReadRoles={canReadRoles}
                    onAction={(type) => setSelectedAction({ type, user })}
                  />
                </React.Fragment>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {canWrite ? (
        <CreateUserDialog
          open={creating}
          onOpenChange={setCreating}
          canReadRoles={canReadRoles}
          roles={rolesQuery.data ?? []}
          rolesPending={rolesQuery.isPending}
          rolesError={rolesQuery.error}
        />
      ) : null}

      {canWrite &&
      selectedAction &&
      selectedUser &&
      (selectedAction.type !== "roles" || canReadRoles) ? (
        <UserActionDialog
          key={`${selectedUser.id}-${selectedUser.updated_at}-${selectedAction.type}`}
          action={selectedAction.type}
          user={selectedUser}
          current={me?.id === selectedUser.id}
          roles={rolesQuery.data ?? []}
          rolesPending={rolesQuery.isPending}
          rolesError={rolesQuery.error}
          onClose={() => setSelectedAction(null)}
        />
      ) : null}
    </div>
  )
}

function UsersSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-label="Loading users">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 py-2">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-5 w-52 max-w-full" />
          </div>
          <Skeleton className="hidden h-7 w-28 sm:block" />
        </div>
      ))}
    </div>
  )
}

function UserRow({
  user,
  current,
  canWrite,
  canReadRoles,
  onAction,
}: {
  user: User
  current: boolean
  canWrite: boolean
  canReadRoles: boolean
  onAction: (action: UserAction) => void
}) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 lg:flex-row lg:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{user.username}</span>
          <Badge variant={user.is_active ? "secondary" : "destructive"}>
            {user.is_active ? "Active" : "Disabled"}
          </Badge>
          {current ? <Badge variant="outline">You</Badge> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {user.roles.length > 0 ? (
            user.roles.map((role) => (
              <Badge key={role} variant="outline">
                {role}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">No roles</span>
          )}
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">
          {user.scopes.length}
        </span>{" "}
        effective scope{user.scopes.length === 1 ? "" : "s"}
      </div>

      {canWrite ? (
        <div className="flex flex-wrap gap-2 lg:justify-end">
          {canReadRoles ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction("roles")}
            >
              <ShieldCheck data-icon="inline-start" />
              Roles
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction("status")}
          >
            {user.is_active ? (
              <UserX data-icon="inline-start" />
            ) : (
              <UserCheck data-icon="inline-start" />
            )}
            {user.is_active ? "Deactivate" : "Activate"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction("password")}
          >
            <KeyRound data-icon="inline-start" />
            Reset password
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onAction("delete")}
          >
            <Trash2 data-icon="inline-start" />
            Delete
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function CreateUserDialog({
  open,
  onOpenChange,
  canReadRoles,
  roles,
  rolesPending,
  rolesError,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  canReadRoles: boolean
  roles: Role[]
  rolesPending: boolean
  rolesError: unknown
}) {
  const create = useCreateUserMutation()
  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [selectedRoles, setSelectedRoles] = React.useState<string[]>([])
  const [errors, setErrors] = React.useState<{
    username?: string
    password?: string
    form?: string
  }>({})

  const reset = () => {
    setUsername("")
    setPassword("")
    setSelectedRoles([])
    setErrors({})
  }

  const handleOpenChange = (next: boolean) => {
    if (!next && create.isPending) return
    onOpenChange(next)
    if (!next) reset()
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextErrors: typeof errors = {}
    if (username.length === 0) nextErrors.username = "Enter a username"
    if (username.length > 100) {
      nextErrors.username = "Username must be 100 characters or fewer"
    }
    if (password.length === 0) nextErrors.password = "Enter a password"
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    create.mutate(
      {
        username,
        password,
        roles: canReadRoles ? selectedRoles : undefined,
      },
      {
        onSuccess: (created) => {
          toast.success(`Created ${created.username}`)
          reset()
          onOpenChange(false)
        },
        onError: (error) =>
          setErrors({
            form: errorMessage(error, "User creation failed"),
          }),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>
            Add a sign-in account. Roles can be assigned now when their catalog
            is available.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="max-h-[60vh] overflow-y-auto px-1">
            <FieldGroup>
              <Field data-invalid={Boolean(errors.username)}>
                <FieldLabel htmlFor="create-user-username">Username</FieldLabel>
                <Input
                  id="create-user-username"
                  value={username}
                  minLength={1}
                  maxLength={100}
                  autoComplete="off"
                  autoFocus
                  disabled={create.isPending}
                  aria-invalid={errors.username ? true : undefined}
                  onChange={(event) => {
                    setUsername(event.target.value)
                    setErrors((current) => ({
                      ...current,
                      username: undefined,
                    }))
                  }}
                />
                {errors.username ? (
                  <FieldError>{errors.username}</FieldError>
                ) : null}
              </Field>

              <Field data-invalid={Boolean(errors.password)}>
                <FieldLabel htmlFor="create-user-password">Password</FieldLabel>
                <Input
                  id="create-user-password"
                  type="password"
                  value={password}
                  autoComplete="new-password"
                  disabled={create.isPending}
                  aria-invalid={errors.password ? true : undefined}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setErrors((current) => ({
                      ...current,
                      password: undefined,
                    }))
                  }}
                />
                {errors.password ? (
                  <FieldError>{errors.password}</FieldError>
                ) : null}
              </Field>

              {canReadRoles ? (
                <RolePicker
                  roles={roles}
                  selected={selectedRoles}
                  onChange={setSelectedRoles}
                  pending={rolesPending}
                  error={rolesError}
                  disabled={create.isPending}
                />
              ) : (
                <Field>
                  <FieldLabel>Roles</FieldLabel>
                  <FieldDescription>
                    This account will be created without roles because you
                    cannot read the role catalog.
                  </FieldDescription>
                </Field>
              )}

              {errors.form ? <FieldError>{errors.form}</FieldError> : null}
            </FieldGroup>
          </div>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="ghost"
              disabled={create.isPending}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <Spinner data-icon="inline-start" /> : null}
              Create user
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RolePicker({
  roles,
  selected,
  onChange,
  pending,
  error,
  disabled,
}: {
  roles: Role[]
  selected: string[]
  onChange: (roles: string[]) => void
  pending: boolean
  error: unknown
  disabled: boolean
}) {
  const id = React.useId()

  const toggle = (name: string, checked: boolean) => {
    onChange(
      checked ? [...selected, name] : selected.filter((role) => role !== name)
    )
  }

  return (
    <FieldSet disabled={disabled}>
      <FieldLegend variant="label">Roles</FieldLegend>
      {pending ? (
        <FieldDescription className="flex items-center gap-2">
          <Spinner /> Loading role catalog
        </FieldDescription>
      ) : null}
      {error ? (
        <FieldError>
          {errorMessage(error, "Role catalog could not be loaded")}
        </FieldError>
      ) : null}
      {!pending && !error && roles.length === 0 ? (
        <FieldDescription>No roles are available.</FieldDescription>
      ) : null}
      {roles.length > 0 ? (
        <FieldGroup className="max-h-48 overflow-y-auto rounded-lg border p-3">
          {roles.map((role) => {
            const checkboxId = `${id}-${role.name}`
            return (
              <Field
                key={role.name}
                orientation="horizontal"
                data-disabled={disabled || undefined}
              >
                <Checkbox
                  id={checkboxId}
                  checked={selected.includes(role.name)}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    toggle(role.name, checked === true)
                  }
                />
                <FieldLabel htmlFor={checkboxId}>{role.name}</FieldLabel>
              </Field>
            )
          })}
        </FieldGroup>
      ) : null}
    </FieldSet>
  )
}

function UserActionDialog({
  action,
  user,
  current,
  roles,
  rolesPending,
  rolesError,
  onClose,
}: {
  action: UserAction
  user: User
  current: boolean
  roles: Role[]
  rolesPending: boolean
  rolesError: unknown
  onClose: () => void
}) {
  if (action === "roles") {
    return (
      <RolesDialog
        user={user}
        roles={roles}
        rolesPending={rolesPending}
        rolesError={rolesError}
        onClose={onClose}
      />
    )
  }
  if (action === "status") {
    return <StatusDialog user={user} current={current} onClose={onClose} />
  }
  if (action === "password") {
    return <PasswordDialog user={user} onClose={onClose} />
  }
  return <DeleteDialog user={user} current={current} onClose={onClose} />
}

function RolesDialog({
  user,
  roles,
  rolesPending,
  rolesError,
  onClose,
}: {
  user: User
  roles: Role[]
  rolesPending: boolean
  rolesError: unknown
  onClose: () => void
}) {
  const replaceRoles = useReplaceUserRolesMutation()
  const [selected, setSelected] = React.useState<string[]>(user.roles)
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    replaceRoles.mutate(
      { id: user.id, roles: selected },
      {
        onSuccess: () => {
          toast.success(`Updated roles for ${user.username}`)
          onClose()
        },
        onError: (problem) =>
          setError(errorMessage(problem, "Role assignment failed")),
      }
    )
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !replaceRoles.isPending) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign roles to {user.username}</DialogTitle>
          <DialogDescription>
            Saving replaces the account&apos;s complete role list with this
            selection.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <RolePicker
              roles={roles}
              selected={selected}
              onChange={setSelected}
              pending={rolesPending}
              error={rolesError}
              disabled={replaceRoles.isPending}
            />
            {error ? <FieldError>{error}</FieldError> : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="ghost"
              disabled={replaceRoles.isPending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                replaceRoles.isPending || rolesPending || Boolean(rolesError)
              }
            >
              {replaceRoles.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : null}
              Save roles
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function StatusDialog({
  user,
  current,
  onClose,
}: {
  user: User
  current: boolean
  onClose: () => void
}) {
  const update = useUpdateUserMutation()
  const [error, setError] = React.useState<string | null>(null)
  const deactivating = user.is_active

  const handleUpdate = () => {
    setError(null)
    update.mutate(
      { id: user.id, is_active: !user.is_active },
      {
        onSuccess: () => {
          toast.success(
            deactivating
              ? `Deactivated ${user.username}`
              : `Activated ${user.username}`
          )
          onClose()
        },
        onError: (problem) =>
          setError(errorMessage(problem, "Account update failed")),
      }
    )
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !update.isPending) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {deactivating ? "Deactivate" : "Activate"} {user.username}?
          </DialogTitle>
          <DialogDescription>
            {deactivating
              ? "This account will no longer be able to sign in or make authenticated requests. The backend will verify whether the change is allowed."
              : "This account will be allowed to authenticate again with its existing roles."}
          </DialogDescription>
        </DialogHeader>
        {deactivating && current ? (
          <Alert variant="destructive">
            <AlertTitle>This is your current account</AlertTitle>
            <AlertDescription>
              Deactivating it can end your own access to this application.
            </AlertDescription>
          </Alert>
        ) : null}
        {error ? <FieldError>{error}</FieldError> : null}
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={update.isPending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={deactivating ? "destructive" : "default"}
            disabled={update.isPending}
            onClick={handleUpdate}
          >
            {update.isPending ? <Spinner data-icon="inline-start" /> : null}
            {deactivating ? "Deactivate user" : "Activate user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PasswordDialog({
  user,
  onClose,
}: {
  user: User
  onClose: () => void
}) {
  const resetPassword = useResetUserPasswordMutation()
  const [password, setPassword] = React.useState("")
  const [confirmation, setConfirmation] = React.useState("")
  const [errors, setErrors] = React.useState<{
    password?: string
    confirmation?: string
    form?: string
  }>({})

  const clear = () => {
    setPassword("")
    setConfirmation("")
    setErrors({})
  }

  const close = () => {
    if (resetPassword.isPending) return
    clear()
    onClose()
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors: typeof errors = {}
    if (password.length === 0) nextErrors.password = "Enter a new password"
    if (confirmation.length === 0) {
      nextErrors.confirmation = "Repeat the new password"
    } else if (password !== confirmation) {
      nextErrors.confirmation = "The two passwords do not match"
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    resetPassword.mutate(
      { id: user.id, new_password: password },
      {
        onSuccess: () => {
          toast.success(`Reset password for ${user.username}`)
          clear()
          onClose()
        },
        onError: (problem) =>
          setErrors({ form: errorMessage(problem, "Password reset failed") }),
      }
    )
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset {user.username}&apos;s password</DialogTitle>
          <DialogDescription>
            Enter the replacement password twice. The backend applies its
            password policy when you save.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.password)}>
              <FieldLabel htmlFor="reset-user-password">
                New password
              </FieldLabel>
              <Input
                id="reset-user-password"
                type="password"
                value={password}
                autoComplete="new-password"
                autoFocus
                disabled={resetPassword.isPending}
                aria-invalid={errors.password ? true : undefined}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setErrors((current) => ({ ...current, password: undefined }))
                }}
              />
              {errors.password ? (
                <FieldError>{errors.password}</FieldError>
              ) : null}
            </Field>
            <Field data-invalid={Boolean(errors.confirmation)}>
              <FieldLabel htmlFor="reset-user-password-confirmation">
                Repeat new password
              </FieldLabel>
              <Input
                id="reset-user-password-confirmation"
                type="password"
                value={confirmation}
                autoComplete="new-password"
                disabled={resetPassword.isPending}
                aria-invalid={errors.confirmation ? true : undefined}
                onChange={(event) => {
                  setConfirmation(event.target.value)
                  setErrors((current) => ({
                    ...current,
                    confirmation: undefined,
                  }))
                }}
              />
              {errors.confirmation ? (
                <FieldError>{errors.confirmation}</FieldError>
              ) : null}
            </Field>
            {errors.form ? <FieldError>{errors.form}</FieldError> : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="ghost"
              disabled={resetPassword.isPending}
              onClick={close}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={resetPassword.isPending}>
              {resetPassword.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : null}
              Reset password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteDialog({
  user,
  current,
  onClose,
}: {
  user: User
  current: boolean
  onClose: () => void
}) {
  const remove = useDeleteUserMutation()
  const [error, setError] = React.useState<string | null>(null)

  const handleDelete = () => {
    setError(null)
    remove.mutate(user.id, {
      onSuccess: () => {
        toast.success(`Deleted ${user.username}`)
        onClose()
      },
      onError: (problem) =>
        setError(errorMessage(problem, "User deletion failed")),
    })
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !remove.isPending) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {user.username}?</DialogTitle>
          <DialogDescription>
            This permanently removes the account. The backend will reject the
            request if its identity rules do not allow it.
          </DialogDescription>
        </DialogHeader>
        <Alert variant="destructive">
          <Trash2 />
          <AlertTitle>
            {current ? "This is your current account" : "This cannot be undone"}
          </AlertTitle>
          <AlertDescription>
            {current
              ? "Deleting it can end your own access to this application."
              : "The user and its role assignments will be removed."}
          </AlertDescription>
        </Alert>
        {error ? <FieldError>{error}</FieldError> : null}
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={remove.isPending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={remove.isPending}
            onClick={handleDelete}
          >
            {remove.isPending ? <Spinner data-icon="inline-start" /> : null}
            Delete user
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
