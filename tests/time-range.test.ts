import assert from "node:assert/strict"
import test from "node:test"

import {
  TIME_RANGE_PRESET_GROUPS,
  findTimeRangePreset,
} from "../src/lib/time-range-presets.ts"
import {
  bucketDurationMs,
  formatAbsoluteTime,
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

test("supports Zabbix calendar boundary expressions", () => {
  const localNow = new Date(2026, 7, 20, 12, 30, 45, 123)
  const day = resolveTimeExpression("now/d", localNow)
  assert.deepEqual(
    [day.getFullYear(), day.getMonth(), day.getDate(), day.getHours()],
    [2026, 7, 20, 0]
  )

  const week = resolveTimeExpression("now/w", localNow)
  assert.deepEqual(
    [week.getFullYear(), week.getMonth(), week.getDate(), week.getDay()],
    [2026, 7, 17, 1]
  )

  const previousMonth = resolveTimeExpression("now-1M/M", localNow)
  assert.deepEqual(
    [
      previousMonth.getFullYear(),
      previousMonth.getMonth(),
      previousMonth.getDate(),
    ],
    [2026, 6, 1]
  )
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

test("formats picker values in browser-local absolute syntax", () => {
  assert.equal(
    formatAbsoluteTime(new Date(2026, 7, 20, 4, 5)),
    "2026-08-20 04:05"
  )
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

test("every quick range resolves to a valid non-empty window", () => {
  for (const group of TIME_RANGE_PRESET_GROUPS) {
    for (const preset of group.presets) {
      assert.doesNotThrow(
        () => resolveTimeRange(preset.range, NOW),
        `${group.label}: ${preset.label}`
      )
    }
  }
})

test("parses backend bucket headers without a frontend preset list", () => {
  assert.equal(bucketDurationMs("30s"), 30_000)
  assert.equal(bucketDurationMs("15m"), 900_000)
  assert.equal(bucketDurationMs("1h"), 3_600_000)
  assert.equal(bucketDurationMs("7d"), 604_800_000)
  assert.throws(() => bucketDurationMs("30 seconds"))
})

test("names the preset an applied window came from", () => {
  for (const group of TIME_RANGE_PRESET_GROUPS) {
    for (const preset of group.presets) {
      assert.equal(
        findTimeRangePreset(preset.range)?.label,
        preset.label,
        `${group.label}: ${preset.label}`
      )
    }
  }
  assert.equal(
    findTimeRangePreset({ from: " now-1h ", to: " now " })?.label,
    "Last 1 hour"
  )
  assert.equal(findTimeRangePreset({ from: "now-90m", to: "now" }), undefined)
  assert.equal(
    findTimeRangePreset({ from: "2026-08-18 00:00", to: "2026-08-20 00:00" }),
    undefined
  )
})
