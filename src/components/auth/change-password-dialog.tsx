import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/client"
import { passwordChangeSchema } from "@/lib/api/types"
import { useChangePasswordMutation } from "@/lib/queries/auth"
import * as React from "react"
import { toast } from "sonner"

interface ChangePasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Self-service password change. The current password is required — that is
 * what stops a stolen access token from being enough to take an account over —
 * and the backend ends every other session and returns a fresh token pair, so
 * this tab stays signed in while the others do not.
 */
export function ChangePasswordDialog({
  open,
  onOpenChange,
}: ChangePasswordDialogProps) {
  const [current, setCurrent] = React.useState("")
  const [next, setNext] = React.useState("")
  const [confirm, setConfirm] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)

  const change = useChangePasswordMutation()

  const close = (isOpen: boolean) => {
    onOpenChange(isOpen)
    if (!isOpen) {
      setCurrent("")
      setNext("")
      setConfirm("")
      setError(null)
    }
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    const parsed = passwordChangeSchema.safeParse({
      current_password: current,
      new_password: next,
      confirm_password: confirm,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the fields")
      return
    }
    setError(null)

    change.mutate(
      {
        current_password: parsed.data.current_password,
        new_password: parsed.data.new_password,
      },
      {
        onSuccess: () => {
          toast.success("Password changed. Other sessions were signed out.")
          close(false)
        },
        onError: (failure) =>
          setError(
            failure instanceof ApiError
              ? failure.status === 401
                ? "That is not your current password."
                : failure.message
              : "Could not reach the API."
          ),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            Every other session is signed out; this one stays open.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="password-current">
                Current password
              </FieldLabel>
              <Input
                id="password-current"
                type="password"
                value={current}
                autoComplete="current-password"
                disabled={change.isPending}
                onChange={(event) => setCurrent(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password-new">New password</FieldLabel>
              <Input
                id="password-new"
                type="password"
                value={next}
                autoComplete="new-password"
                disabled={change.isPending}
                onChange={(event) => setNext(event.target.value)}
              />
              <FieldDescription>
                Whatever the backend's policy allows — it is the one that
                enforces it.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="password-confirm">
                Repeat new password
              </FieldLabel>
              <Input
                id="password-confirm"
                type="password"
                value={confirm}
                autoComplete="new-password"
                disabled={change.isPending}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </Field>
            {error ? <FieldError>{error}</FieldError> : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="ghost"
              disabled={change.isPending}
              onClick={() => close(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={change.isPending}>
              {change.isPending ? <Spinner data-icon="inline-start" /> : null}
              Change password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
