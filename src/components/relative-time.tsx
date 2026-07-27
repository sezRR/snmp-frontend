import { useClock } from "@/hooks/use-clock"
import { formatDateTime, formatRelativeTime } from "@/lib/format"

/**
 * A live "N seconds ago" that counts on its own. The plain formatter is a
 * one-shot read, so a value rendered once would sit frozen until whatever
 * query owns it happened to refetch.
 */
export function RelativeTime({
  iso,
  className,
}: {
  iso: string
  className?: string
}) {
  const now = useClock(1000)
  return (
    <time dateTime={iso} title={formatDateTime(iso)} className={className}>
      {formatRelativeTime(iso, now)}
    </time>
  )
}
