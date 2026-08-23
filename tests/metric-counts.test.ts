import assert from "node:assert/strict"
import test from "node:test"

import { metricCountSchema } from "../src/lib/api/types.ts"

test("parses raw, 1 minute, and 1 hour metric counts", () => {
  const latest = "2026-08-23T12:00:00Z"
  const oldest = "2026-08-22T12:00:00Z"
  const result = metricCountSchema.parse({
    mac: "fa:16:3e:00:00:01",
    samples: 120,
    latest,
    metrics: { rows: 120, samples: 120, oldest, latest },
    metrics_1m: {
      rows: 60,
      samples: 120,
      oldest: "2026-08-22T12:00:00Z",
      latest: "2026-08-23T11:59:00Z",
    },
    metrics_1h: {
      rows: 1,
      samples: 120,
      oldest: "2026-08-22T12:00:00Z",
      latest: "2026-08-23T11:00:00Z",
    },
  })

  assert.equal(result.metrics.rows, 120)
  assert.equal(result.metrics_1m.samples, 120)
  assert.equal(result.metrics_1m.latest, "2026-08-23T11:59:00Z")
  assert.equal(result.metrics_1h.rows, 1)
  assert.equal(result.metrics_1h.latest, "2026-08-23T11:00:00Z")
})

test("accepts an empty source with no oldest or newest row", () => {
  const empty = { rows: 0, samples: 0, oldest: null, latest: null }
  const result = metricCountSchema.parse({
    mac: "fa:16:3e:00:00:01",
    samples: 0,
    latest: null,
    metrics: empty,
    metrics_1m: empty,
    metrics_1h: empty,
  })

  assert.equal(result.metrics_1h.latest, null)
})

test("rejects the legacy flat-only count payload", () => {
  assert.throws(() =>
    metricCountSchema.parse({
      mac: "fa:16:3e:00:00:01",
      samples: 120,
      latest: "2026-08-23T12:00:00Z",
    })
  )
})
