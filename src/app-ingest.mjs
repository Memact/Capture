import { normalizeCaptureEvent, shouldSkipSensitiveEvent, validateCaptureEvent } from "./capture-event.mjs"
import { createMemoryCaptureStore } from "./storage/capture-store.mjs"

export async function ingestAppCaptureEvent(input, options = {}) {
  const event = normalizeCaptureEvent(input, options.defaults || {})
  const validation = validateCaptureEvent(event)
  if (!validation.ok) return { accepted: false, skipped: false, errors: validation.errors }
  if (shouldSkipSensitiveEvent(event)) {
    return { accepted: false, skipped: true, reason: "sensitive_event", event }
  }
  const store = options.store || createMemoryCaptureStore()
  await store.writeCaptureEvent(event)
  return { accepted: true, event }
}
