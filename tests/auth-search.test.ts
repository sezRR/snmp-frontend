import assert from "node:assert/strict"
import test from "node:test"

import { returnToSchema } from "../src/lib/auth/search.ts"

test("accepts an internal return URL", () => {
  const value = "/machines/00:11:22:33:44:55?from=now-1h#cpu"
  assert.equal(returnToSchema.parse(value), value)
})

test("rejects external return URLs", () => {
  assert.equal(returnToSchema.parse("https://example.com"), undefined)
  assert.equal(returnToSchema.parse("//example.com"), undefined)
  assert.equal(returnToSchema.parse("/\\example.com"), undefined)
  assert.equal(returnToSchema.parse("/\t/example.com"), undefined)
  assert.equal(returnToSchema.parse("/\n/example.com"), undefined)
  assert.equal(returnToSchema.parse("/\r/example.com"), undefined)
  assert.equal(returnToSchema.parse("/safe/..//example.com"), undefined)
})

test("rejects login as a return URL", () => {
  assert.equal(returnToSchema.parse("/login"), undefined)
  assert.equal(returnToSchema.parse("/LOGIN"), undefined)
  assert.equal(returnToSchema.parse("/%6cogin"), undefined)
  assert.equal(returnToSchema.parse("/login?redirect=%2Fmachines"), undefined)
  assert.equal(returnToSchema.parse("/login#form"), undefined)
})

test("rejects unauthorized as a return URL", () => {
  assert.equal(returnToSchema.parse("/unauthorized"), undefined)
  assert.equal(returnToSchema.parse("/UNAUTHORIZED"), undefined)
  assert.equal(returnToSchema.parse("/unauthor%69zed"), undefined)
  assert.equal(
    returnToSchema.parse("/unauthorized?redirect=%2Fmachines"),
    undefined
  )
})

test("rejects a return URL that already nests a login redirect", () => {
  const nested = "/login?redirect=" + encodeURIComponent("/login?redirect=%2F")
  assert.equal(returnToSchema.parse(nested), undefined)
})

test("rejects guard pages after normalizing the path", () => {
  assert.equal(
    returnToSchema.parse("/machines/../login?redirect=%2Fmachines"),
    undefined
  )
  assert.equal(returnToSchema.parse("/machines/%2e%2e/unauthorized"), undefined)
})

test("returns a canonical internal path", () => {
  assert.equal(returnToSchema.parse("/machines/../views/1"), "/views/1")
})

test("keeps paths that merely start with the guard page names", () => {
  assert.equal(returnToSchema.parse("/logins"), "/logins")
  assert.equal(
    returnToSchema.parse("/unauthorized-pages"),
    "/unauthorized-pages"
  )
})
