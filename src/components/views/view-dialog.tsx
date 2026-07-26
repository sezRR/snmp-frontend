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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { machineName, machinesQueryOptions } from "@/lib/queries/machines"
import { type View, saveView } from "@/lib/views"
import { useQuery } from "@tanstack/react-query"
import * as React from "react"
import { toast } from "sonner"

interface ViewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Omit to create; pass a view to edit it in place. */
  view?: View
  onSaved?: (view: View) => void
}

export function ViewDialog({
  open,
  onOpenChange,
  view,
  onSaved,
}: ViewDialogProps) {
  const { data: machines } = useQuery(machinesQueryOptions())
  const [name, setName] = React.useState(view?.name ?? "")
  const [macs, setMacs] = React.useState<string[]>(view?.macs ?? [])
  const [error, setError] = React.useState<string | null>(null)

  // Reopening for a different view has to reload the form.
  const [lastView, setLastView] = React.useState(view)
  if (view !== lastView) {
    setLastView(view)
    setName(view?.name ?? "")
    setMacs(view?.macs ?? [])
    setError(null)
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      setError("Give the view a name")
      return
    }
    if (macs.length === 0) {
      setError("Pick at least one machine")
      return
    }
    const saved = saveView({ id: view?.id, name: name.trim(), macs })
    toast.success(`View "${saved.name}" saved`)
    onOpenChange(false)
    // Only a freshly created view is worth navigating to; editing one should
    // leave the user where they were.
    if (!view) onSaved?.(saved)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{view ? "Edit view" : "New view"}</DialogTitle>
          <DialogDescription>
            A view is a saved subset of the fleet. It is stored in this browser
            only — the backend never sees it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field data-invalid={error && !name.trim() ? true : undefined}>
              <FieldLabel htmlFor="view-name">Name</FieldLabel>
              <Input
                id="view-name"
                placeholder="Tenant A"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>Machines</FieldLabel>
              {machines && machines.length > 0 ? (
                <ToggleGroup
                  variant="outline"
                  multiple
                  className="flex w-full flex-wrap justify-start gap-2"
                  value={macs}
                  onValueChange={(next: string[]) => setMacs(next)}
                >
                  {machines.map((machine) => (
                    <ToggleGroupItem key={machine.mac} value={machine.mac}>
                      {machineName(machine)}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Register a machine first.
                </span>
              )}
            </Field>
            {error ? <FieldError>{error}</FieldError> : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit">Save view</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
