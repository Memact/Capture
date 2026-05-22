import test from "node:test"
import assert from "node:assert/strict"
import { ingestAppCaptureEvent } from "../src/app-ingest.mjs"
import { ARTICLE_READING_EVENT_TYPES, normalizeCaptureEvent, shouldSkipSensitiveEvent, validateCaptureEvent } from "../src/capture-event.mjs"
import { extensionSnapshotToCaptureEvents } from "../src/extension-adapter.mjs"
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

test("extension snapshots become normal capture events", () => {
  const events = extensionSnapshotToCaptureEvents({
    activities: [{
      activity_id: "act_1",
      title: "Read API docs",
      url: "https://example.com/docs",
      page_type: "documentation",
      started_at: "2026-05-21T10:00:00.000Z"
    }],
    content_units: [{
      unit_id: "unit_1",
      title: "Discount comparison",
      text: "Comparing discounts across stores",
      url: "https://shop.example/deals"
    }]
  })

  assert.equal(events.length, 2)
  assert.equal(events[0].source_app, "memact-extension")
  assert.equal(events[0].category, "learning")
  assert.equal(events[1].category, "shopping")
})

test("article reading events normalize with reading category", () => {
  for (const eventType of ARTICLE_READING_EVENT_TYPES) {
    const event = normalizeCaptureEvent({
      event_type: eventType,
      category: "reading",
      source_app: "article-app",
      payload: {
        title: "AI policy guide",
        topic: "ai policy",
        scroll_depth: "88"
      }
    })
    assert.equal(event.schema_version, "memact.capture_event.v0")
    assert.equal(event.event_type, eventType)
    assert.equal(event.category, "reading")
    assert.equal(event.payload.scroll_depth, 88)
  }
})

test("article event still requires category", () => {
  const result = validateCaptureEvent({
    event_type: "article_open",
    source_app: "article-app",
    payload: { title: "A" }
  })
  assert.equal(result.ok, false)
})
