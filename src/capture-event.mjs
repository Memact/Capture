const SENSITIVE_RE = /login|password|auth|bank|payment|checkout|billing|inbox|message|medical|patient/i
const SENSITIVE_FIELD_RE = /password|token|secret|otp|card|cvv|authorization|cookie|email/i

export const ARTICLE_READING_EVENT_TYPES = Object.freeze([
  "article_open",
  "article_read_time",
  "scroll_depth_update",
  "article_finish",
  "article_revisit",
  "topic_skip",
  "summary_expand",
  "summary_collapse"
])

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
    payload: normalizeArticleReadingPayload(String(input.event_type || input.type || defaults.event_type || "").trim(), redactSensitivePayload(input.payload || {})),
    permission_context: input.permission_context || defaults.permission_context || {},
    evidence: input.evidence || {},
    metadata: input.metadata || {}
  }
}

function normalizeArticleReadingPayload(eventType, payload) {
  if (!ARTICLE_READING_EVENT_TYPES.includes(eventType)) return payload
  return {
    ...payload,
    title: clean(payload.title),
    topic: clean(payload.topic),
    source: clean(payload.source),
    url: clean(payload.url),
    read_time_seconds: number(payload.read_time_seconds),
    scroll_depth: number(payload.scroll_depth),
    estimated_read_time_minutes: number(payload.estimated_read_time_minutes),
    summary_style: clean(payload.summary_style)
  }
}

function clean(value) {
  return typeof value === "string" ? value.trim().slice(0, 2000) : value
}

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
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
