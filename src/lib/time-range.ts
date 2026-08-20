const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const RELATIVE_TIME = /^now(?:([+-])(\d+)([smhdwMy]))?$/
const ABSOLUTE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/
const BUCKET_DURATION = /^(\d+(?:\.\d+)?)(s|m|h|d)$/

export interface TimeRange {
  from: string
  to: string
}

export const DEFAULT_TIME_RANGE = {
  from: "now-1h",
  to: "now",
} as const satisfies TimeRange

export const TIME_EXPRESSION_EXAMPLE = "Use now, now-1h, or YYYY-MM-DD HH:mm."

function addCalendarMonths(date: Date, amount: number): Date {
  const result = new Date(date)
  const day = result.getDate()
  result.setDate(1)
  result.setMonth(result.getMonth() + amount)
  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate()
  result.setDate(Math.min(day, lastDay))
  return result
}

function offsetNow(now: Date, amount: number, unit: string): Date {
  if (unit === "M") return addCalendarMonths(now, amount)
  if (unit === "y") return addCalendarMonths(now, amount * 12)

  const result = new Date(now)
  if (unit === "d" || unit === "w") {
    result.setDate(result.getDate() + amount * (unit === "w" ? 7 : 1))
    return result
  }

  const scale = unit === "s" ? SECOND : unit === "m" ? MINUTE : HOUR
  return new Date(result.getTime() + amount * scale)
}

function parseAbsoluteTime(match: RegExpExecArray): Date {
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] =
    match
  const year = Number(yearText)
  const month = Number(monthText) - 1
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText ?? "0")

  const result = new Date(0)
  result.setFullYear(year, month, day)
  result.setHours(hour, minute, second, 0)

  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month ||
    result.getDate() !== day ||
    result.getHours() !== hour ||
    result.getMinutes() !== minute ||
    result.getSeconds() !== second
  ) {
    throw new Error(TIME_EXPRESSION_EXAMPLE)
  }
  return result
}

/** Resolve one Zabbix-style expression against a shared notion of now. */
export function resolveTimeExpression(value: string, now = new Date()): Date {
  const expression = value.trim()
  const relative = RELATIVE_TIME.exec(expression)
  if (relative) {
    const [, sign, amountText, unit] = relative
    if (!sign || !amountText || !unit) return new Date(now)
    const direction = sign === "+" ? 1 : -1
    const result = offsetNow(now, direction * Number(amountText), unit)
    if (Number.isNaN(result.getTime())) throw new Error(TIME_EXPRESSION_EXAMPLE)
    return result
  }

  const absolute = ABSOLUTE_TIME.exec(expression)
  if (absolute) return parseAbsoluteTime(absolute)
  throw new Error(TIME_EXPRESSION_EXAMPLE)
}

export function resolveTimeRange(
  range: TimeRange,
  now = new Date()
): { from: Date; to: Date } {
  const from = resolveTimeExpression(range.from, now)
  const to = resolveTimeExpression(range.to, now)
  if (from >= to) throw new Error("From must be before To.")
  return { from, to }
}

export function isTimeExpression(value: string): boolean {
  try {
    resolveTimeExpression(value)
    return true
  } catch {
    return false
  }
}

/** A relative To keeps moving; only exactly `now` receives the SSE tail. */
export function isRelativeTime(value: string): boolean {
  return RELATIVE_TIME.test(value.trim())
}

export function isLiveTimeRange(range: TimeRange): boolean {
  return range.to.trim() === "now"
}

/** Parse the effective preset returned in X-Metrics-Bucket. */
export function bucketDurationMs(value: string): number {
  const match = BUCKET_DURATION.exec(value.trim())
  if (!match) throw new Error(`Invalid X-Metrics-Bucket header: ${value}`)
  const amount = Number(match[1])
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid X-Metrics-Bucket header: ${value}`)
  }
  const unit = match[2]
  const scale =
    unit === "s" ? SECOND : unit === "m" ? MINUTE : unit === "h" ? HOUR : DAY
  return amount * scale
}
