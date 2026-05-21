const SENSITIVE_RE = /login|password|auth|bank|payment|checkout|billing|inbox|message|medical|patient/i
const SENSITIVE_FIELD_RE = /password|token|secret|otp|card|cvv|authorization|cookie|email/i

export function normalizeCaptureEvent(input = {}, defaults = {}) {
  return {
    schema_version: "memact.capture_event.v0",
    event_id: input.event_id || defaults.event_id || `evt_${Date.now().toString(36)}`,
    event_type: String(input.event_type || input.type || defaults.event_type || "").trim(),
    source_app: String(input.source_app || defaults.source_app || defaults.app_id || "app").trim(),
    app_id: input.app_id || defaults.app_id || "",
    user_ref: input.user_ref || defaults.user_ref || "",
    occurred_at: normalizeTime(input.occurred_at || input.timestamp || defaults.occurred_at),
    category: String(input.category || defaults.category || "").trim(),
    payload: redactSensitivePayload(input.payload || {}),
    permission_context: input.permission_context || defaults.permission_context || {},
    evidence: input.evidence || {},
    metadata: input.metadata || {}
  }
}

export function validateCaptureEvent(input = {}) {
  const event = normalizeCaptureEvent(input)
  const errors = []
  if (!event.event_type) errors.push("event_type is required")
  if (!event.source_app) errors.push("source_app is required")
  if (!event.occurred_at) errors.push("occurred_at is required")
  if (!event.category) errors.push("category is required")
  return { ok: errors.length === 0, event, errors }
}

export function redactSensitivePayload(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {}
  return Object.fromEntries(
    Object.entries(payload)
      .filter(([key]) => !SENSITIVE_FIELD_RE.test(key))
      .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 2000) : value])
  )
}

export function shouldSkipSensitiveEvent(event = {}) {
  const text = [
    event.event_type,
    event.category,
    event.payload?.url,
    event.payload?.title,
    event.payload?.domain
  ].filter(Boolean).join(" ")
  return SENSITIVE_RE.test(text)
}

function normalizeTime(value) {
  const date = new Date(value || Date.now())
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}
