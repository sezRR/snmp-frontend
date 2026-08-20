import assert from "node:assert/strict"
import test from "node:test"

import type { ChartPoint } from "../src/lib/metrics.ts"
import { withBucketGaps } from "../src/lib/live-buckets.ts"

const MINUTE = 60_000

const point = (ts: string, cpu: number | null = 1): ChartPoint => ({
  ts: new Date(ts).toISOString(),
  cpu_percent: cpu,
  ram_percent: null,
  disk_percent: null,
  disk_read_bps: null,
  disk_write_bps: null,
  disk_read_iops: null,
  disk_write_iops: null,
  net_rx_bps: null,
  net_tx_bps: null,
})

const stamps = (points: ChartPoint[]) => points.map((entry) => entry.ts)

test("spans the queried window when data starts late or ends early", () => {
  const window = {
    from: new Date("2026-08-20T04:10:00Z").toISOString(),
    to: new Date("2026-08-20T04:15:00Z").toISOString(),
  }
  const filled = withBucketGaps(
    [point("2026-08-20T04:12:00Z"), point("2026-08-20T04:13:00Z")],
    MINUTE,
    window
  )

  assert.deepEqual(stamps(filled), [
    "2026-08-20T04:10:00.000Z",
    "2026-08-20T04:11:00.000Z",
    "2026-08-20T04:12:00.000Z",
    "2026-08-20T04:13:00.000Z",
    "2026-08-20T04:14:00.000Z",
  ])
  // Padding carries no readings, so the gap stays visible as a break.
  assert.equal(filled[0].cpu_percent, null)
  assert.equal(filled[4].cpu_percent, null)
  assert.equal(filled[2].cpu_percent, 1)
})

test("stops one bucket short of To, which the window excludes", () => {
  const filled = withBucketGaps([point("2026-08-20T04:10:00Z")], MINUTE, {
    from: new Date("2026-08-20T04:10:00Z").toISOString(),
    to: new Date("2026-08-20T04:13:00Z").toISOString(),
  })

  // A bucket stamped 04:13 would cover 04:13–04:14, which is past To.
  assert.deepEqual(stamps(filled), [
    "2026-08-20T04:10:00.000Z",
    "2026-08-20T04:11:00.000Z",
    "2026-08-20T04:12:00.000Z",
  ])
})

test("floors the leading edge the way the backend buckets do", () => {
  const filled = withBucketGaps([point("2026-08-20T04:15:00Z")], 5 * MINUTE, {
    from: new Date("2026-08-20T04:12:00Z").toISOString(),
    to: new Date("2026-08-20T04:20:00Z").toISOString(),
  })

  assert.deepEqual(stamps(filled), [
    "2026-08-20T04:10:00.000Z",
    "2026-08-20T04:15:00.000Z",
  ])
})

test("keeps a live tail that already runs past To", () => {
  const filled = withBucketGaps(
    [point("2026-08-20T04:10:00Z"), point("2026-08-20T04:11:00Z")],
    MINUTE,
    {
      from: new Date("2026-08-20T04:10:00Z").toISOString(),
      to: new Date("2026-08-20T04:11:30Z").toISOString(),
    }
  )

  assert.deepEqual(stamps(filled), [
    "2026-08-20T04:10:00.000Z",
    "2026-08-20T04:11:00.000Z",
  ])
})

test("still breaks the line across an outage inside the window", () => {
  const filled = withBucketGaps(
    [point("2026-08-20T04:10:00Z"), point("2026-08-20T04:14:00Z")],
    MINUTE,
    {
      from: new Date("2026-08-20T04:10:00Z").toISOString(),
      to: new Date("2026-08-20T04:15:00Z").toISOString(),
    }
  )

  assert.equal(filled.length, 5)
  assert.deepEqual(
    filled.map((entry) => entry.cpu_percent),
    [1, null, null, null, 1]
  )
})

test("leaves an empty result empty rather than drawing a window of nulls", () => {
  assert.deepEqual(
    withBucketGaps([], MINUTE, {
      from: new Date("2026-08-20T04:10:00Z").toISOString(),
      to: new Date("2026-08-20T05:10:00Z").toISOString(),
    }),
    []
  )
})
