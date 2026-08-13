import { useClock } from "@/hooks/use-clock"
import { SKEW_TOLERANCE_MS } from "@/lib/format"

/**
 * Time until the collector's next round, from the last tick plus its interval.
 *
 * Both admin panels showed "last tick N ago" counting up with nothing to
 * measure it against, so a loop running late looked identical to one running
 * on time. Counting down to the round the interval implies is what makes the
 * two agree.
 */
/** Rounds an anchor may be behind before the loop is called late, not stale. */
const OVERDUE_AFTER_INTERVALS = 3

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
  const period = intervalSeconds * 1000
  const since = now - Date.parse(lastTickAt)

  if (!Number.isFinite(since) || period <= 0) {
    return <span className={className}>—</span>
  }

  // An anchor further ahead than drift explains means the collector's clock and
  // the browser's disagree. `since` then stays negative round after round, the
  // countdown below re-reads a full period every tick, and a stopped collector
  // is indistinguishable from a healthy one. Say so instead.
  if (since < -SKEW_TOLERANCE_MS) {
    return (
      <span
        className={className}
        title="Collector clock is ahead of this browser"
      >
        clock skew
      </span>
    )
  }

  // The anchor is a round that has already finished, and it is only re-read
  // once a round at best — so it is routinely a round or two old. Counting
  // down to `anchor + interval` then reads "due" for the whole gap. Stepping
  // the anchor forward in whole intervals instead keeps the number inside the
  // interval, which is the only range a loop running on time can be in.
  const remaining = Math.ceil(
    (since < 0 ? period : period - (since % period)) / 1000
  )

  return (
    <span className={className}>
      {/* Further behind than the loop's own cadence explains: the round is
          overrunning, or nothing is ticking. Projecting through that would
          show a healthy countdown for a collector that has stopped. */}
      {since > period * OVERDUE_AFTER_INTERVALS
        ? "overdue"
        : `in ${remaining} s`}
    </span>
  )
}
