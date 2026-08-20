import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { useAuth } from "@/lib/auth/rbac"
import { returnToSchema } from "@/lib/auth/search"
import { cn } from "@/lib/utils"
import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import { ArrowLeft, ShieldAlert, Undo2 } from "lucide-react"
import { z } from "zod"

const searchSchema = z.object({
  redirect: returnToSchema,
  /** Which half of the rule the visitor failed — see `auth/rbac`. */
  reason: z
    .enum(["insufficient_role", "insufficient_scope"])
    .default("insufficient_scope")
    .catch("insufficient_scope"),
})

/**
 * Where a route guard sends someone who is signed in but not allowed in.
 *
 * It lives inside the authenticated layout on purpose: the visitor still has a
 * perfectly good session, so they keep the sidebar and can go somewhere they
 * *are* allowed, rather than being thrown onto a full-page wall that implies
 * something is broken. Nothing is broken — they simply lack a permission.
 */
export const Route = createFileRoute("/_authenticated/unauthorized")({
  validateSearch: searchSchema,
  component: UnauthorizedPage,
})

const REASON_TEXT = {
  insufficient_role:
    "Your account does not hold a role that page is limited to.",
  insufficient_scope:
    "Your roles do not grant a permission that page requires.",
} as const

function UnauthorizedPage() {
  const { redirect: attempted, reason } = Route.useSearch()
  const auth = useAuth()
  const router = useRouter()

  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className="bg-destructive/10 text-destructive ring-1 ring-destructive/20"
        >
          <ShieldAlert />
        </EmptyMedia>
        <EmptyTitle>Access denied</EmptyTitle>
        <EmptyDescription>
          {REASON_TEXT[reason]} Ask an administrator to grant it, then reload.
        </EmptyDescription>
      </EmptyHeader>

      <EmptyContent className="max-w-lg gap-4">
        {attempted ? (
          <p className="rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs wrap-break-word text-muted-foreground">
            {attempted}
          </p>
        ) : null}

        <PermissionList label="Your roles" items={auth.user?.roles ?? []} />
        <PermissionList
          label="Your permissions"
          items={auth.user?.scopes ?? []}
        />

        <div className="flex flex-wrap justify-center gap-2">
          <Link to="/" className={cn(buttonVariants({ variant: "outline" }))}>
            <ArrowLeft data-icon="inline-start" />
            Back to the dashboard
          </Link>
          {/* History rather than a link to `attempted`: the address came off
              the URL bar, and the router's `to` is a checked route path. */}
          <Button variant="ghost" onClick={() => router.history.back()}>
            <Undo2 data-icon="inline-start" />
            Go back
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  )
}

/** The user's own roles or scopes, so "ask for what?" has a concrete answer. */
function PermissionList({
  label,
  items,
}: {
  label: string
  items: readonly string[]
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {items.length === 0 ? (
        <span className="text-xs text-muted-foreground italic">None</span>
      ) : (
        <div className="flex flex-wrap justify-center gap-1">
          {items.map((item) => (
            <Badge key={item} variant="outline" className="font-mono text-xs">
              {item}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
