import { Button } from "@/components/ui/button"
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
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { Machine } from "@/lib/api/types"
import { machineName } from "@/lib/queries/machines"
import { type View, removeMachinesFromView } from "@/lib/views"
import { Minus } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"

interface RemoveFromViewDialogProps {
  view: View
  /** The view's members, already resolved against the registered fleet. */
  members: Machine[]
}

/**
 * Takes machines out of a view without touching the backend.
 *
 * Deliberately separate from deregistering: dropping a machine from a saved
 * grouping is a local edit and reversible by adding it back, while
 * deregistering stops the polling and destroys the history. Sharing one
 * control for both would make the cheap action wear the expensive one's
 * consequences.
 */
export function RemoveFromViewDialog({
  view,
  members,
}: RemoveFromViewDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [picked, setPicked] = React.useState<string[]>([])
  const [error, setError] = React.useState<string | null>(null)

  const reset = () => {
    setPicked([])
    setError(null)
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (picked.length === 0) {
      setError("Pick at least one machine")
      return
    }
    removeMachinesFromView(view.id, picked)
    toast.success(
      `Removed ${picked.length} machine${picked.length === 1 ? "" : "s"} from ${view.name}`
    )
    setOpen(false)
    reset()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline">
            <Minus data-icon="inline-start" />
            Remove
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Remove from {view.name}</DialogTitle>
          <DialogDescription>
            The machines stay registered and keep being polled — only this
            view&apos;s membership changes.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel>
                Machines
                <span className="ml-auto flex items-center gap-1">
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() =>
                      setPicked(members.map((machine) => machine.mac))
                    }
                  >
                    Select all {members.length}
                  </Button>
                  {picked.length > 0 ? (
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={() => setPicked([])}
                    >
                      Clear
                    </Button>
                  ) : null}
                </span>
              </FieldLabel>
              <ToggleGroup
                variant="outline"
                multiple
                className="flex max-h-56 w-full flex-wrap justify-start gap-2 overflow-y-auto"
                value={picked}
                onValueChange={(next: string[]) => setPicked(next)}
              >
                {members.map((machine) => (
                  <ToggleGroupItem key={machine.mac} value={machine.mac}>
                    {machineName(machine)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <FieldDescription>
                Add them back at any time — views are just saved lists of MACs.
              </FieldDescription>
            </Field>
            {error ? <FieldError>{error}</FieldError> : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {picked.length > 1
                ? `Remove ${picked.length} machines`
                : "Remove"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
