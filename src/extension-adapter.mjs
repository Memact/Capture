import { normalizeCaptureEvent, shouldSkipSensitiveEvent } from "./capture-event.mjs"

export function extensionSnapshotToCaptureEvents(snapshot = {}, defaults = {}) {
  const events = []
  const baseDefaults = {
    source_app: defaults.source_app || "memact-extension",
    app_id: defaults.app_id || "memact-extension",
    user_ref: defaults.user_ref || "",
    permission_context: defaults.permission_context || {}
  }

  for (const item of Array.isArray(snapshot.activities) ? snapshot.activities : []) {
    events.push(normalizeCaptureEvent({
      event_id: item.activity_id || item.id,
      event_type: item.activity_type || item.type || "extension_activity",
      occurred_at: item.ended_at || item.started_at || item.timestamp,
      category: inferCategory(item),
      payload: {
        title: item.title,
        url: item.url,
        domain: item.domain,
        page_type: item.page_type,
        duration_ms: item.duration_ms
      },
      evidence: {
        source: "extension_activity",
        confidence: item.confidence
      },
      metadata: {
        session_id: item.session_id,
        source_record_id: item.activity_id || item.id
      }
    }, baseDefaults))
  }

  for (const unit of Array.isArray(snapshot.content_units) ? snapshot.content_units : []) {
    events.push(normalizeCaptureEvent({
      event_id: unit.unit_id || unit.id,
      event_type: "extension_content_unit",
      occurred_at: unit.created_at || unit.timestamp,
      category: inferCategory(unit),
      payload: {
        title: unit.title,
        url: unit.url,
        domain: unit.domain,
        text: unit.text,
        unit_type: unit.unit_type
      },
      evidence: {
        source: "extension_content",
        confidence: unit.confidence
      },
      metadata: {
        source_record_id: unit.unit_id || unit.id
      }
    }, baseDefaults))
  }

  return events.filter((event) => !shouldSkipSensitiveEvent(event))
}

function inferCategory(record = {}) {
  const text = [
    record.category,
    record.page_type,
    record.page_type_label,
    record.packet_type,
    record.title,
    record.url,
    record.domain
  ].filter(Boolean).join(" ").toLowerCase()

  if (/research|docs|documentation|paper|learning|course|tutorial/.test(text)) return "learning"
  if (/news|article|publisher|newspaper/.test(text)) return "web:news"
  if (/shop|cart|product|discount|price|deal/.test(text)) return "shopping"
  if (/code|github|developer|debug|issue|pull request/.test(text)) return "productivity"
  if (/video|podcast|media|caption/.test(text)) return "media"
  return "webpage"
}
