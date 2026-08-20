import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
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
  DialogTrigger,
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
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/client"
import type { RoleOut as Role, ScopeInfo } from "@/lib/api/types"
import { requireRouteScope } from "@/lib/auth/route-guards"
import { SCOPES, useHasScope } from "@/lib/auth/scopes"
import {
  useCreateRoleMutation,
  useDeleteRoleMutation,
  useReplaceRoleScopesMutation,
  useRolesQuery,
  useScopesQuery,
  useUpdateRoleMutation,
} from "@/lib/queries/identity"
import { Navigate, createFileRoute } from "@tanstack/react-router"
import {
  CircleAlert,
  LockKeyhole,
  Pencil,
  Plus,
  RefreshCw,
  Shield,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import * as React from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/_authenticated/roles")({
  beforeLoad: ({ context, location }) =>
    requireRouteScope(context.queryClient, SCOPES.rolesRead, location.href),
  component: RolesPage,
})

interface MetadataErrors {
  name?: string
  description?: string
}

const REQUIRED_ROLE_SCOPES: readonly string[] = [
  SCOPES.machinesRead,
  SCOPES.metricsRead,
]

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

function descriptionError(description: string): string | undefined {
  return description.length > 500
    ? "Description must be 500 characters or fewer"
    : undefined
}

function validateMetadata(name: string, description: string): MetadataErrors {
  const trimmedName = name.trim()
  return {
    name:
      trimmedName.length === 0
        ? "Enter a role name"
        : trimmedName.length > 100
          ? "Name must be 100 characters or fewer"
          : undefined,
    description: descriptionError(description),
  }
}

function RolesPage() {
  const canRead = useHasScope(SCOPES.rolesRead)
  const canWrite = useHasScope(SCOPES.rolesWrite)
  const rolesQuery = useRolesQuery()
  const scopesQuery = useScopesQuery()
  const [editing, setEditing] = React.useState<Role | null>(null)
  const [managing, setManaging] = React.useState<Role | null>(null)
  const [deleting, setDeleting] = React.useState<Role | null>(null)

  if (!canRead) return <Navigate to="/" replace />

  const currentEditing = editing
    ? (rolesQuery.data?.find((role) => role.name === editing.name) ?? editing)
    : null
  const currentManaging = managing
    ? (rolesQuery.data?.find((role) => role.name === managing.name) ?? managing)
    : null
  const currentDeleting = deleting
    ? (rolesQuery.data?.find((role) => role.name === deleting.name) ?? deleting)
    : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold">Roles</h1>
          <p className="text-sm text-muted-foreground">
            Permission sets assigned to accounts across the fleet.
          </p>
        </div>
        {canWrite ? (
          <CreateRoleDialog
            scopes={scopesQuery.data}
            scopesPending={scopesQuery.isPending}
            scopesError={scopesQuery.error}
            onRetryScopes={() => void scopesQuery.refetch()}
          />
        ) : null}
      </div>

      {rolesQuery.isPending ? <RolesPending /> : null}

      {rolesQuery.isError ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Roles could not be loaded</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {errorMessage(rolesQuery.error, "Could not reach the API.")}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={rolesQuery.isFetching}
              onClick={() => void rolesQuery.refetch()}
            >
              {rolesQuery.isFetching ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RefreshCw data-icon="inline-start" />
              )}
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {rolesQuery.data?.length === 0 ? (
        <Empty className="min-h-64 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Shield />
            </EmptyMedia>
            <EmptyTitle>No roles found</EmptyTitle>
            <EmptyDescription>
              {canWrite
                ? "Create a role to group the permissions accounts need."
                : "There are no roles available to review."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {rolesQuery.data && rolesQuery.data.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Access roles</CardTitle>
            <CardDescription>
              {rolesQuery.data.length} role
              {rolesQuery.data.length === 1 ? "" : "s"}, including protected
              system roles.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col">
            {rolesQuery.data.map((role, index) => (
              <React.Fragment key={role.name}>
                {index > 0 ? <Separator /> : null}
                <RoleRow
                  role={role}
                  canWrite={canWrite}
                  onEdit={() => setEditing(role)}
                  onManage={() => setManaging(role)}
                  onDelete={() => setDeleting(role)}
                />
              </React.Fragment>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {canWrite && currentEditing ? (
        <EditRoleDialog
          key={currentEditing.updated_at}
          role={currentEditing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {canWrite && currentManaging ? (
        <ManagePermissionsDialog
          key={currentManaging.updated_at}
          role={currentManaging}
          scopes={scopesQuery.data}
          scopesPending={scopesQuery.isPending}
          scopesError={scopesQuery.error}
          onRetryScopes={() => void scopesQuery.refetch()}
          onClose={() => setManaging(null)}
        />
      ) : null}
      {canWrite && currentDeleting ? (
        <DeleteRoleDialog
          role={currentDeleting}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </div>
  )
}

function RolesPending() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Loading roles</CardTitle>
        <CardDescription>
          Reading role definitions and their current permissions.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-32 items-center justify-center gap-2 text-muted-foreground">
        <Spinner />
        <span>Loading roles...</span>
      </CardContent>
    </Card>
  )
}

function RoleRow({
  role,
  canWrite,
  onEdit,
  onManage,
  onDelete,
}: {
  role: Role
  canWrite: boolean
  onEdit: () => void
  onManage: () => void
  onDelete: () => void
}) {
  return (
    <article className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-medium">{role.name}</h2>
          {role.is_system ? <Badge variant="secondary">System</Badge> : null}
          <Badge variant="outline">
            {role.scopes.length} scope{role.scopes.length === 1 ? "" : "s"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {role.description || "No description provided."}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {role.scopes.length > 0 ? (
            role.scopes.map((scope) => (
              <Badge key={scope} variant="outline" className="font-mono">
                {scope}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">
              No permissions assigned
            </span>
          )}
        </div>
      </div>

      {canWrite ? (
        <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end">
          <Button
            type="button"
            variant="outline"
            className="flex-1 sm:flex-none"
            onClick={onEdit}
          >
            <Pencil data-icon="inline-start" />
            Description
          </Button>
          {!role.is_system ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={onManage}
              >
                <ShieldCheck data-icon="inline-start" />
                Permissions
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="flex-1 sm:flex-none"
                onClick={onDelete}
              >
                <Trash2 data-icon="inline-start" />
                Delete
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

function CreateRoleDialog({
  scopes,
  scopesPending,
  scopesError,
  onRetryScopes,
}: {
  scopes: ScopeInfo[] | undefined
  scopesPending: boolean
  scopesError: unknown
  onRetryScopes: () => void
}) {
  const create = useCreateRoleMutation()
  const id = React.useId()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [selectedScopes, setSelectedScopes] = React.useState<string[]>(() => [
    ...REQUIRED_ROLE_SCOPES,
  ])
  const [errors, setErrors] = React.useState<MetadataErrors>({})
  const [mutationError, setMutationError] = React.useState<string | null>(null)

  const reset = () => {
    setName("")
    setDescription("")
    setSelectedScopes([...REQUIRED_ROLE_SCOPES])
    setErrors({})
    setMutationError(null)
    create.reset()
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const nextErrors = validateMetadata(name, description)
    setErrors(nextErrors)
    if (nextErrors.name || nextErrors.description) return

    setMutationError(null)
    const trimmedName = name.trim()
    try {
      await create.mutateAsync({
        name: trimmedName,
        description: description.trim() || undefined,
        scopes: [...new Set([...REQUIRED_ROLE_SCOPES, ...selectedScopes])],
      })
      toast.success(`Created ${trimmedName}`)
      setOpen(false)
      reset()
    } catch (error) {
      const message = errorMessage(error, "Role creation failed")
      setMutationError(message)
      toast.error(message)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && create.isPending) return
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <Plus data-icon="inline-start" />
            New role
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create role</DialogTitle>
          <DialogDescription>
            Name the role and choose its complete initial permission set. The
            role and permissions are saved together.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="max-h-[60vh] overflow-y-auto px-1">
            <FieldGroup>
              <Field data-invalid={errors.name ? true : undefined}>
                <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
                <Input
                  id={`${id}-name`}
                  value={name}
                  maxLength={100}
                  autoComplete="off"
                  disabled={create.isPending}
                  aria-invalid={errors.name ? true : undefined}
                  onChange={(event) => {
                    setName(event.target.value)
                    setErrors((current) => ({ ...current, name: undefined }))
                    setMutationError(null)
                  }}
                />
                <FieldDescription>
                  1-100 characters. Role names cannot be changed later.
                </FieldDescription>
                {errors.name ? <FieldError>{errors.name}</FieldError> : null}
              </Field>

              <DescriptionField
                id={`${id}-description`}
                value={description}
                error={errors.description}
                disabled={create.isPending}
                onChange={(next) => {
                  setDescription(next)
                  setErrors((current) => ({
                    ...current,
                    description: undefined,
                  }))
                  setMutationError(null)
                }}
              />

              <ScopePicker
                idPrefix={`${id}-create-scope`}
                scopes={scopes}
                pending={scopesPending}
                error={scopesError}
                selected={selectedScopes}
                required={REQUIRED_ROLE_SCOPES}
                disabled={create.isPending}
                onSelectedChange={setSelectedScopes}
                onRetry={onRetryScopes}
              />

              {mutationError ? (
                <Alert variant="destructive">
                  <CircleAlert />
                  <AlertTitle>Role not created</AlertTitle>
                  <AlertDescription>{mutationError}</AlertDescription>
                </Alert>
              ) : null}
            </FieldGroup>
          </div>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="ghost"
              disabled={create.isPending}
              onClick={() => {
                setOpen(false)
                reset()
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                create.isPending || scopesPending || Boolean(scopesError)
              }
            >
              {create.isPending ? <Spinner data-icon="inline-start" /> : null}
              Create role
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditRoleDialog({
  role,
  onClose,
}: {
  role: Role
  onClose: () => void
}) {
  const update = useUpdateRoleMutation()
  const id = React.useId()
  const [description, setDescription] = React.useState(role.description ?? "")
  const [error, setError] = React.useState<string | null>(null)
  const [validationError, setValidationError] = React.useState<
    string | undefined
  >()

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const problem = descriptionError(description)
    setValidationError(problem)
    if (problem) return

    setError(null)
    try {
      await update.mutateAsync({
        name: role.name,
        description: description.trim() || null,
      })
      toast.success(`Updated ${role.name}`)
      onClose()
    } catch (failure) {
      const message = errorMessage(failure, "Role update failed")
      setError(message)
      toast.error(message)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !update.isPending) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit role description</DialogTitle>
          <DialogDescription>
            Update the role's explanatory text without changing its identity or
            permissions.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <FieldGroup>
            <Alert>
              <LockKeyhole />
              <AlertTitle>{role.name}</AlertTitle>
              <AlertDescription>Role names are immutable.</AlertDescription>
            </Alert>
            <DescriptionField
              id={`${id}-description`}
              value={description}
              error={validationError}
              disabled={update.isPending}
              onChange={(next) => {
                setDescription(next)
                setValidationError(undefined)
                setError(null)
              }}
            />
            {error ? (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>Role not updated</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="ghost"
              disabled={update.isPending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? <Spinner data-icon="inline-start" /> : null}
              Save description
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DescriptionField({
  id,
  value,
  error,
  disabled,
  onChange,
}: {
  id: string
  value: string
  error?: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>Description (optional)</FieldLabel>
      <Input
        id={id}
        value={value}
        maxLength={500}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldDescription>{value.length}/500 characters</FieldDescription>
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  )
}

function ManagePermissionsDialog({
  role,
  scopes,
  scopesPending,
  scopesError,
  onRetryScopes,
  onClose,
}: {
  role: Role
  scopes: ScopeInfo[] | undefined
  scopesPending: boolean
  scopesError: unknown
  onRetryScopes: () => void
  onClose: () => void
}) {
  const replaceScopes = useReplaceRoleScopesMutation()
  const id = React.useId()
  const [selectedScopes, setSelectedScopes] = React.useState<string[]>(
    role.scopes
  )
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (role.is_system) return

    setError(null)
    try {
      await replaceScopes.mutateAsync({
        name: role.name,
        scopes: selectedScopes,
      })
      toast.success(`Updated permissions for ${role.name}`)
      onClose()
    } catch (failure) {
      const message = errorMessage(failure, "Permissions update failed")
      setError(message)
      toast.error(message)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !replaceScopes.isPending) onClose()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage permissions</DialogTitle>
          <DialogDescription>
            Replace the complete permission set for {role.name}. Unchecked
            permissions are removed when you save.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <FieldGroup>
            <ScopePicker
              idPrefix={`${id}-manage-scope`}
              scopes={scopes}
              pending={scopesPending}
              error={scopesError}
              selected={selectedScopes}
              disabled={replaceScopes.isPending || role.is_system}
              onSelectedChange={(next) => {
                setSelectedScopes(next)
                setError(null)
              }}
              onRetry={onRetryScopes}
            />
            {error ? (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>Permissions not updated</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="ghost"
              disabled={replaceScopes.isPending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                replaceScopes.isPending ||
                role.is_system ||
                scopesPending ||
                Boolean(scopesError)
              }
            >
              {replaceScopes.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : null}
              Save permissions
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ScopePicker({
  idPrefix,
  scopes,
  pending,
  error,
  selected,
  required = [],
  disabled,
  onSelectedChange,
  onRetry,
}: {
  idPrefix: string
  scopes: ScopeInfo[] | undefined
  pending: boolean
  error: unknown
  selected: string[]
  required?: readonly string[]
  disabled: boolean
  onSelectedChange: (scopes: string[]) => void
  onRetry: () => void
}) {
  const setScope = (scope: string, checked: boolean) => {
    if (checked) {
      if (!selected.includes(scope)) onSelectedChange([...selected, scope])
      return
    }
    onSelectedChange(selected.filter((entry) => entry !== scope))
  }

  return (
    <FieldSet>
      <FieldLegend variant="label">Permissions</FieldLegend>
      <FieldDescription>
        Each permission controls one read or write capability.
      </FieldDescription>

      {pending ? (
        <div className="flex min-h-24 items-center justify-center gap-2 rounded-lg border text-muted-foreground">
          <Spinner />
          <span>Loading permissions...</span>
        </div>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Permissions could not be loaded</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{errorMessage(error, "Could not reach the API.")}</span>
            <Button type="button" size="sm" variant="outline" onClick={onRetry}>
              <RefreshCw data-icon="inline-start" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {!pending && !error && scopes?.length === 0 ? (
        <Empty className="min-h-28 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Shield />
            </EmptyMedia>
            <EmptyTitle>No permissions available</EmptyTitle>
            <EmptyDescription>
              The API returned an empty scope catalog.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {!pending && !error && scopes && scopes.length > 0 ? (
        <FieldGroup className="max-h-72 overflow-y-auto rounded-lg border p-3">
          {scopes.map((scope, index) => {
            const checkboxId = `${idPrefix}-${index}`
            const isRequired = required.includes(scope.name)
            return (
              <Field
                key={scope.name}
                orientation="horizontal"
                data-disabled={disabled || isRequired ? true : undefined}
              >
                <Checkbox
                  id={checkboxId}
                  checked={selected.includes(scope.name)}
                  disabled={disabled || isRequired}
                  onCheckedChange={(checked) =>
                    setScope(scope.name, Boolean(checked))
                  }
                />
                <FieldContent>
                  <FieldLabel htmlFor={checkboxId}>{scope.name}</FieldLabel>
                  <FieldDescription>
                    {scope.description || "No description available."}
                    {isRequired ? " Required for new roles." : ""}
                  </FieldDescription>
                </FieldContent>
              </Field>
            )
          })}
        </FieldGroup>
      ) : null}
    </FieldSet>
  )
}

function DeleteRoleDialog({
  role,
  onClose,
}: {
  role: Role
  onClose: () => void
}) {
  const remove = useDeleteRoleMutation()
  const [error, setError] = React.useState<string | null>(null)

  const handleDelete = async () => {
    if (role.is_system) return
    setError(null)
    try {
      await remove.mutateAsync(role.name)
      toast.success(`Deleted ${role.name}`)
      onClose()
    } catch (failure) {
      const message = errorMessage(failure, "Role deletion failed")
      setError(message)
      toast.error(message)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !remove.isPending) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete role?</DialogTitle>
          <DialogDescription>
            This permanently removes the role. It cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <Alert variant="destructive">
          <Trash2 />
          <AlertTitle>{role.name}</AlertTitle>
          <AlertDescription>
            Roles still assigned to accounts cannot be deleted. The API will
            report the conflict without changing those assignments.
          </AlertDescription>
        </Alert>
        {error ? (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>Role not deleted</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
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
            disabled={remove.isPending || role.is_system}
            onClick={() => void handleDelete()}
          >
            {remove.isPending ? <Spinner data-icon="inline-start" /> : null}
            Delete role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
