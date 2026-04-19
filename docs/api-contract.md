# Memact Capture API Contract

Downstream Memact engines must consume Capture only through the public data contract.

## Public Functions

Located in `extension/memact/capture-api.js`.

- `getEvents({ limit })`
  Returns normalized, noise-filtered event records in chronological order.

- `getSessions({ limit })`
  Returns chronological session windows derived from the event stream.

- `getActivities({ limit })`
  Returns semantic activity units derived from the same session builder.

- `getCaptureSnapshot({ limit })`
  Returns a full snapshot with `events`, `sessions`, and `activities`.

## Snapshot Shape

```json
{
  "system": "capture",
  "snapshot_type": "capture-memory-export",
  "schema_version": 1,
  "generated_at": "2026-04-03T12:00:00.000Z",
  "counts": {
    "events": 120,
    "sessions": 28,
    "activities": 28
  },
  "events": [],
  "sessions": [],
  "activities": []
}
```

## Activity Shape

```json
{
  "id": 14,
  "key": "startup",
  "label": "Reading about startup",
  "subject": "startup",
  "summary": "Saved page about startup.",
  "started_at": "2026-04-03T08:00:00.000Z",
  "ended_at": "2026-04-03T08:14:00.000Z",
  "duration_ms": 840000,
  "event_count": 3,
  "keyphrases": ["startup", "pitch deck"],
  "domains": ["youtube.com"],
  "applications": ["chrome"],
  "mode": "reading",
  "event_ids": [11, 12, 13],
  "events": [
    {
      "id": 11,
      "occurred_at": "2026-04-03T08:05:00.000Z",
      "url": "https://youtube.com/watch?v=startup-ideas",
      "domain": "youtube.com",
      "application": "chrome",
      "title": "Startup Ideas Video",
      "context_subject": "startup",
      "page_type": "video",
      "structured_summary": "Saved page about startup."
    }
  ]
}
```

The nested `events` array is especially useful for downstream evidence-first systems such as Inference, Origin, and Influence because it preserves the page/domain/title trail behind a higher-level activity.

## Bridge Messages

These messages are now forwarded through `extension/memact/bridge.js`.

- `CAPTURE_GET_EVENTS`
- `CAPTURE_GET_SESSIONS`
- `CAPTURE_GET_ACTIVITIES`
- `CAPTURE_GET_SNAPSHOT`
- `CAPTURE_EXPORT_SNAPSHOT`

Responses:

- `CAPTURE_GET_EVENTS_RESULT`
- `CAPTURE_GET_SESSIONS_RESULT`
- `CAPTURE_GET_ACTIVITIES_RESULT`
- `CAPTURE_GET_SNAPSHOT_RESULT`
- `CAPTURE_EXPORT_SNAPSHOT_RESULT`

## Browser Runtime Export

When an authorized host is running with the extension bridge enabled, the page exposes a small runtime API:

That runtime is provided by `extension/memact/page-api.js`, which is injected into the page by `extension/memact/bridge.js`.

- `window.capture.getEvents({ limit })`
- `window.capture.getSessions({ limit })`
- `window.capture.getActivities({ limit })`
- `window.capture.getSnapshot({ limit })`
- `window.capture.exportSnapshot({ limit, filename, download })`
- `window.capture.downloadSnapshot({ limit, filename })`

`exportSnapshot()` returns the same Capture snapshot contract and, by default, asks the extension to save it into `memact_ai/capture-snapshot-<timestamp>-<id>.json` inside the user's Downloads workspace.

`downloadSnapshot()` is a convenience wrapper when you only need the saved file metadata.

Separately from the page runtime, the extension now also maintains an automatic rolling export at `memact_ai/capture-snapshot-latest.json` while new captures are being recorded. Downstream engines can consume that rolling file directly without requiring a manual console export on each run.

This runtime is available by default on:

- `memact.com`
- localhost development hosts

It can also be enabled on any other authorized origin after the user explicitly grants access by clicking the extension action on that host once.

## Dependency Rule

- Capture must not import Inference, Schema, Origin, Influence, or Interface.
- Downstream engines may consume only the snapshot/activity contract above.
- No downstream engine may read `db.js`, `context-pipeline.js`, or other Capture internals directly.
