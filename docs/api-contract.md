# Captanet API Contract

Influnet must consume Captanet only through the public Captanet data contract.

## Public Functions

Located in `extension/memact/captanet-api.js`.

- `getEvents({ limit })`
  Returns normalized, noise-filtered event records in chronological order.

- `getSessions({ limit })`
  Returns chronological session windows derived from the event stream.

- `getActivities({ limit })`
  Returns semantic activity units derived from the same session builder.

- `getCaptanetSnapshot({ limit })`
  Returns a full snapshot with `events`, `sessions`, and `activities`.

## Snapshot Shape

```json
{
  "system": "captanet",
  "snapshot_type": "captanet-memory-export",
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

The nested `events` array is especially useful for downstream evidence-first systems such as Influnet because it preserves the page/domain/title trail behind a higher-level activity.

## Bridge Messages

These messages are now forwarded through `extension/memact/bridge.js`.

- `CAPTANET_GET_EVENTS`
- `CAPTANET_GET_SESSIONS`
- `CAPTANET_GET_ACTIVITIES`
- `CAPTANET_GET_SNAPSHOT`

Responses:

- `CAPTANET_GET_EVENTS_RESULT`
- `CAPTANET_GET_SESSIONS_RESULT`
- `CAPTANET_GET_ACTIVITIES_RESULT`
- `CAPTANET_GET_SNAPSHOT_RESULT`

## Browser Runtime Export

When a compatible Memact website host is running with the extension bridge enabled, the page exposes a small runtime API:

That runtime is provided by `extension/memact/page-api.js`, which is injected into the page by `extension/memact/bridge.js`.

- `window.captanet.getEvents({ limit })`
- `window.captanet.getSessions({ limit })`
- `window.captanet.getActivities({ limit })`
- `window.captanet.getSnapshot({ limit })`
- `window.captanet.exportSnapshot({ limit, filename, download })`

`exportSnapshot()` returns the same Captanet snapshot contract and, by default, downloads it as a JSON file that Influnet can analyze directly.

## Dependency Rule

- Captanet must not import Influnet.
- Influnet may consume only the snapshot/activity contract above.
- No Influnet code may read `db.js`, `context-pipeline.js`, or other Captanet internals directly.
