import { useClock } from "@/hooks/use-clock"

/**
 * Time until the collector's next round, from the last tick plus its interval.
 *
 * Both admin panels showed "last tick N ago" counting up with nothing to
 * measure it against, so a loop running late looked identical to one running
 * on time. Counting down to the round the interval implies is what makes the
 * two agree.
 */
export function NextTickCountdown({
  lastTickAt,
  intervalSeconds,
  className,
}: {
  lastTickAt: string
  intervalSeconds: number
  className?: string
}) {
  const now = useClock(1000)
  const dueAt = Date.parse(lastTickAt) + intervalSeconds * 1000

  if (!Number.isFinite(dueAt)) return <span className={className}>—</span>

  const remainingSeconds = Math.ceil((dueAt - now) / 1000)
  return (
    <span className={className}>
      {/* Past due means the tick is running, or the loop has stalled — either
          way the number to show is not a negative one. */}
      {remainingSeconds <= 0 ? "due" : `in ${remainingSeconds} s`}
    </span>
  )
}
