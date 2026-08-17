import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import PixelBlast from "@/components/ui/pixel-blast/pixel-blast-background"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/client"
import { loginSchema } from "@/lib/api/types"
import { hasSession } from "@/lib/auth/session"
import { useLoginMutation } from "@/lib/queries/auth"
import { cn } from "@/lib/utils"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { Activity } from "lucide-react"
import * as React from "react"
import { z } from "zod"

const searchSchema = z.object({
  /**
   * Where the guard turned the visitor away from, to be resumed after signing
   * in. Only a path on this origin survives validation: an absolute URL here
   * would turn the login page into an open redirect, and `//host` is a
   * protocol-relative URL wearing a path's clothes.
   */
  redirect: z
    .string()
    .optional()
    .transform((value) =>
      value && value.startsWith("/") && !value.startsWith("//")
        ? value
        : undefined
    ),
})

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  beforeLoad: ({ search }) => {
    // Already signed in: there is nothing to do here.
    if (hasSession()) {
      throw redirect({ to: search.redirect ?? "/" })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  const { redirect: returnTo } = Route.useSearch()
  const navigate = useNavigate()
  const login = useLoginMutation()

  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [fieldError, setFieldError] = React.useState<string | null>(null)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    const parsed = loginSchema.safeParse({ username, password })
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Fill both fields")
      return
    }
    setFieldError(null)

    login.mutate(parsed.data, {
      onSuccess: () => void navigate({ to: returnTo ?? "/" }),
    })
  }

  // 401 is the wrong password, and saying so is the useful answer; anything
  // else is the backend having a bad day and its own message is better.
  const failure =
    login.error instanceof ApiError
      ? login.error.status === 401
        ? "Wrong username or password."
        : login.error.message
      : login.error
        ? "Could not reach the API."
        : null

  const shadow =
    "max-w-sm inset-shadow-xs dark:inset-shadow-primary-foreground/20"

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <PixelBlast
        className="fixed inset-0 -z-10 backdrop-blur-4xl"
        variant="circle"
        pixelSize={8}
        speed={0}
        fpsCap={10}
        enableRipples={false}
      />
      <Card
        className={cn(
          shadow,
          "w-full max-w-xs bg-muted/50 backdrop-blur-sm shadow-sm"
        )}
      >
        <CardHeader>
          <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Activity className="size-4" />
          </div>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            SNMP Monitor · OpenStack fleet metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="login-username">Username</FieldLabel>
                <Input
                  id="login-username"
                  className={cn(shadow, "shadow-sm bg-muted/20!")}
                  value={username}
                  autoComplete="username"
                  autoFocus
                  disabled={login.isPending}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="login-password">Password</FieldLabel>
                <Input
                  id="login-password"
                  className={cn(shadow, "shadow-sm bg-muted/20!")}
                  type="password"
                  value={password}
                  autoComplete="current-password"
                  disabled={login.isPending}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </Field>
              {fieldError ? <FieldError>{fieldError}</FieldError> : null}
              {failure ? (
                <Alert variant="destructive">
                  <AlertTitle>Sign-in failed</AlertTitle>
                  <AlertDescription>{failure}</AlertDescription>
                </Alert>
              ) : null}
              <Button
                className={cn(shadow)}
                type="submit"
                disabled={login.isPending}
              >
                {login.isPending ? <Spinner data-icon="inline-start" /> : null}
                Sign in
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
