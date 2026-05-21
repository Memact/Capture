import test from "node:test"
import assert from "node:assert/strict"
import { ingestAppCaptureEvent } from "../src/app-ingest.mjs"
import { normalizeCaptureEvent, shouldSkipSensitiveEvent, validateCaptureEvent } from "../src/capture-event.mjs"
import { createMemoryCaptureStore } from "../src/storage/capture-store.mjs"

test("app-fed event normalizes", () => {
  const event = normalizeCaptureEvent({ event_type: "article_read", category: "web:research", payload: {} }, { source_app: "app" })
  assert.equal(event.schema_version, "memact.capture_event.v0")
  assert.equal(event.source_app, "app")
})

test("invalid event fails", () => {
  const result = validateCaptureEvent({ payload: {} })
  assert.equal(result.ok, false)
})

test("sensitive event is skipped and payload is redacted", async () => {
  assert.equal(shouldSkipSensitiveEvent({ event_type: "login_page", category: "auth", payload: {} }), true)
  const result = await ingestAppCaptureEvent({
    event_type: "login_page",
    category: "auth",
    source_app: "app",
    payload: { password: "secret" }
  })
  assert.equal(result.skipped, true)
  assert.equal(Object.hasOwn(result.event.payload, "password"), false)
})

test("stored events are listed", async () => {
  const store = createMemoryCaptureStore()
  const result = await ingestAppCaptureEvent({
    event_type: "article_read",
    category: "web:research",
    source_app: "app",
    payload: { title: "A" }
  }, { store })
  assert.equal(result.accepted, true)
  assert.equal((await store.listCaptureEvents()).length, 1)
})
