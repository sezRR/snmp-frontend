import assert from "node:assert/strict"
import test from "node:test"

import {
  bucketDurationMs,
  isLiveTimeRange,
  isRelativeTime,
  resolveTimeExpression,
  resolveTimeRange,
} from "../src/lib/time-range.ts"

const NOW = new Date("2026-08-20T12:30:00.000Z")

test("resolves now and a single offset against the same instant", () => {
  assert.equal(
    resolveTimeExpression("now", NOW).toISOString(),
    NOW.toISOString()
  )
  assert.equal(
    resolveTimeExpression("now-1h", NOW).toISOString(),
    "2026-08-20T11:30:00.000Z"
  )
  assert.equal(
    resolveTimeExpression("now+15m", NOW).toISOString(),
    "2026-08-20T12:45:00.000Z"
  )
})

test("supports Zabbix second through year units", () => {
  assert.equal(
    resolveTimeExpression("now-30s", NOW).getTime(),
    NOW.getTime() - 30_000
  )
  assert.equal(resolveTimeExpression("now-2d", NOW).getDate(), 18)
  assert.equal(resolveTimeExpression("now-1w", NOW).getDate(), 13)
  assert.equal(resolveTimeExpression("now-1M", NOW).getMonth(), 6)
  assert.equal(resolveTimeExpression("now-1y", NOW).getFullYear(), 2025)
})

test("parses absolute timestamps as browser-local time", () => {
  const result = resolveTimeExpression("2026-08-20 14:05:30")
  assert.equal(result.getFullYear(), 2026)
  assert.equal(result.getMonth(), 7)
  assert.equal(result.getDate(), 20)
  assert.equal(result.getHours(), 14)
  assert.equal(result.getMinutes(), 5)
  assert.equal(result.getSeconds(), 30)
})

test("rejects invalid and chained expressions", () => {
  assert.throws(() => resolveTimeExpression("now-1h-5m", NOW))
  assert.throws(() => resolveTimeExpression("2026-02-30 12:00", NOW))
  assert.throws(() => resolveTimeExpression("yesterday", NOW))
})

test("requires From to precede To", () => {
  assert.throws(
    () => resolveTimeRange({ from: "now", to: "now-1h" }, NOW),
    /From must be before To/
  )
})

test("distinguishes rolling and live end expressions", () => {
  assert.equal(isRelativeTime("now-1h"), true)
  assert.equal(isLiveTimeRange({ from: "now-1h", to: "now" }), true)
  assert.equal(isLiveTimeRange({ from: "now-2h", to: "now-1h" }), false)
})

test("parses backend bucket headers without a frontend preset list", () => {
  assert.equal(bucketDurationMs("30s"), 30_000)
  assert.equal(bucketDurationMs("15m"), 900_000)
  assert.equal(bucketDurationMs("1h"), 3_600_000)
  assert.equal(bucketDurationMs("7d"), 604_800_000)
  assert.throws(() => bucketDurationMs("30 seconds"))
})
