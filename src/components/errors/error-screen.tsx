import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import PixelBlast from "@/components/ui/pixel-blast/pixel-blast-background"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { Link, useLocation, useRouter } from "@tanstack/react-router"
import {
  ArrowLeft,
  CloudAlert,
  type LucideIcon,
  RotateCw,
  SearchX,
  ServerCrash,
  TriangleAlert,
} from "lucide-react"
import * as React from "react"

// The page shown when there is nothing else to show: the API is gone, a route
// threw, or the URL names nothing. One layout for all three, deliberately built
// from the same parts as the sign-in page — a visitor who has only ever seen
// this application fail should still recognise where they are.

type Tone = "danger" | "neutral"

const toneTile: Record<Tone, string> = {
  danger: "bg-destructive/10 text-destructive ring-1 ring-destructive/20",
  neutral: "bg-muted text-muted-foreground ring-1 ring-border",
}

const shadow = "inset-shadow-xs dark:inset-shadow-primary-foreground/20"

interface ErrorScreenProps {
  /** The machine-readable half of the headline: a status, a code, a state. */
  eyebrow: string
  title: string
  description: React.ReactNode
  icon: LucideIcon
  tone?: Tone
  /** The technical line — a URL, a status, an exception message. */
  detail?: string | null
  /** A live line about what the page is doing while it waits. */
  activity?: React.ReactNode
  actions?: React.ReactNode
  footnote?: React.ReactNode
}

export function ErrorScreen({
  eyebrow,
  title,
  description,
  icon: Icon,
  tone = "danger",
  detail,
  activity,
  actions,
  footnote,
}: ErrorScreenProps) {
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
      <div className="flex w-full max-w-sm flex-col gap-3 items-center">
        <Card
          className={cn(
            shadow,
            "w-full bg-muted/50 shadow-sm backdrop-blur-sm"
          )}
        >
          <CardHeader>
            <div
              className={cn(
                "mb-2 flex size-9 items-center justify-center rounded-lg",
                toneTile[tone]
              )}
            >
              <Icon className="size-4" />
            </div>
            <div className="font-mono text-[0.625rem] tracking-[0.18em] text-muted-foreground uppercase">
              {eyebrow}
            </div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>

          {detail || activity ? (
            <CardContent className="flex flex-col gap-2">
              {detail ? (
                <p
                  className={cn(
                    shadow,
                    "rounded-md border bg-muted/20 px-3 py-2 font-mono text-xs wrap-break-word text-muted-foreground"
                  )}
                >
                  {detail}
                </p>
              ) : null}
              {activity}
            </CardContent>
          ) : null}

          {actions ? (
            <CardFooter className="flex flex-wrap gap-2">{actions}</CardFooter>
          ) : null}
        </Card>
        {footnote ? (
          <p className="text-xs text-muted-foreground bg-card border shadow-sm rounded-md px-3 py-1.5 w-max">
            {footnote}
          </p>
        ) : null}
      </div>
    </main>
  )
}

/**
 * The "still trying" line. A dot that pulses rather than a countdown, because a
 * ticking number is a promise about a schedule the retry does not actually
 * keep — and rendering one would need a clock this page has no reason to own.
 */
export function RetryPulse({
  busy,
  children,
}: {
  busy?: boolean
  children: React.ReactNode
}) {
  return (
    <p className="flex items-center gap-2 ml-1 text-xs text-muted-foreground">
      {busy ? (
        <Spinner className="size-3" />
      ) : (
        <span className="relative flex size-2 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive/60" />
          <span className="relative inline-flex size-2 rounded-full bg-destructive" />
        </span>
      )}
      {children}
    </p>
  )
}

export function RetryButton({
  busy,
  onRetry,
  children = "Try again",
}: {
  busy?: boolean
  onRetry: () => void
  children?: React.ReactNode
}) {
  return (
    <Button className={cn(shadow, "flex-1")} onClick={onRetry} disabled={busy}>
      {busy ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <RotateCw data-icon="inline-start" />
      )}
      {children}
    </Button>
  )
}

/** A route threw something the page below could not handle. */
export function RouteErrorScreen({ error }: { error: Error }) {
  const router = useRouter()
  const [reloading, setReloading] = React.useState(false)

  const reload = () => {
    if (reloading) return
    setReloading(true)
    void router.invalidate({ sync: true }).then(
      () => setReloading(false),
      () => setReloading(false)
    )
  }

  return (
    <ErrorScreen
      eyebrow="Unhandled error"
      title="This page stopped working"
      description="Something went wrong while rendering. Your session and your data are untouched — nothing here was saved or sent."
      icon={TriangleAlert}
      detail={error.message || String(error)}
      actions={
        <>
          <RetryButton busy={reloading} onRetry={reload}>
            Reload page
          </RetryButton>
          <Link
            to="/"
            className={cn(
              buttonVariants({ variant: "outline" }),
              shadow,
              "flex-1"
            )}
          >
            <ArrowLeft data-icon="inline-start" />
            Dashboard
          </Link>
        </>
      }
    />
  )
}

/** A URL that names nothing — a stale bookmark, or a machine since removed. */
export function NotFoundScreen() {
  // Read through the router rather than off `window`: the address is state the
  // router already owns, and reading the global during render is not pure.
  const { pathname } = useLocation()

  return (
    <ErrorScreen
      eyebrow="404"
      title="Nothing lives at this address"
      description="The page you asked for does not exist. A machine that was removed from the fleet leaves its old link behind like this."
      icon={SearchX}
      tone="neutral"
      detail={pathname}
      actions={
        <Link
          to="/"
          className={cn(
            buttonVariants({ variant: "outline" }),
            shadow,
            "flex-1"
          )}
        >
          <ArrowLeft data-icon="inline-start" />
          Back to the dashboard
        </Link>
      }
    />
  )
}

/**
 * The API failed its own health check — see `BackendGate` for who decides that.
 *
 * Silence and a bad answer are different failures and are worth saying apart: a
 * backend that never replied is usually the deployment (stopped, restarting, a
 * proxy with nothing behind it), while one that replies with a failing status
 * is running but cannot serve — most often its database.
 */
export function BackendDownScreen({
  status = 0,
  detail,
  busy,
  onRetry,
}: {
  /** The health check's response status, or 0 when nothing answered. */
  status?: number
  detail?: string | null
  busy?: boolean
  onRetry: () => void
}) {
  const answered = status > 0

  return (
    <ErrorScreen
      eyebrow={answered ? `API unhealthy · ${status}` : "API unreachable"}
      title={
        answered
          ? "The metrics API is unhealthy"
          : "Can't reach the metrics API"
      }
      description={
        answered
          ? "The API is running but failing its own health check, so it has nothing dependable to serve. Its database is the usual reason."
          : "The dashboard loaded, but the backend behind it is not answering. Collection keeps running on the server; only this view is blind."
      }
      icon={answered ? ServerCrash : CloudAlert}
      detail={detail}
      activity={
        <RetryPulse busy={busy}>
          {busy ? "Checking the API…" : "Rechecking every few seconds"}
        </RetryPulse>
      }
      actions={
        <RetryButton busy={busy} onRetry={onRetry}>
          Check now
        </RetryButton>
      }
      footnote="This page clears itself the moment the API answers again."
    />
  )
}
