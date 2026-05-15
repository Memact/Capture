# Capture-Layer API Contract

Downstream Memact engines must consume the capture layer only through the public data contract.

The capture layer is the source-of-truth evidence boundary for Memact's memory
infrastructure. It should expose enough structured activity data for downstream
systems to build schema memory, pattern reports, dictionaries, timelines, and
query apps without forcing those systems to read capture internals.

Memact is not an app data broker. Apps use Memact to understand approved
activity and receive scoped context, while the access layer decides what an app
is allowed to ask for and what output it may read.

## Public Functions

Located in `extension/memact/capture-api.js`.

- `getEvents({ limit })`
  Returns normalized, noise-filtered event records in chronological order.

- `getSessions({ limit })`
  Returns chronological session windows derived from the event stream.

- `getActivities({ limit })`
  Returns semantic activity units derived from the same session builder.

- `getContentUnits({ limit })`
  Returns ordered content units captured from webpages, transcripts/captions, PDFs, and image context.

- `getGraphPackets({ limit })`
  Returns multimedia and device graph packets with content units, nodes, edges, evidence links, schema packet candidates, and pending local media jobs.

- `getMediaJobs({ limit })`
  Returns pending local OCR/ASR jobs. These are job descriptors only, not raw media.

- `getCaptureSnapshot({ limit })`
  Returns a full snapshot with `events`, `sessions`, `activities`, `content_units`, `graph_packets`, and `pending_media_jobs`.

Scoped reads:

```js
await window.capture.getSnapshot({
  limit: 3000,
  scopes: ["capture:webpage", "schema:write", "graph:write"]
});
```

When `scopes` are present, Capture redacts output that is not allowed by those
scopes. In particular, nodes and edges require `memory:read_graph`, while
evidence snippets require `memory:read_evidence`.

## Snapshot Shape

```json
{
  "system": "capture",
  "snapshot_type": "capture-memory-export",
  "schema_version": 2,
  "generated_at": "2026-04-03T12:00:00.000Z",
  "counts": {
    "events": 120,
    "sessions": 28,
    "activities": 28,
    "content_units": 240,
    "graph_packets": 92,
    "pending_media_jobs": 3
  },
  "events": [],
  "sessions": [],
  "activities": [],
  "content_units": [],
  "graph_packets": [],
  "pending_media_jobs": []
}
```

## Multimedia Graph Packet Shape

```json
{
  "packet_id": "mgc_12_attention_video",
  "packet_type": "multimedia_graph_capture",
  "schema_version": 1,
  "source": "browser_extension",
  "event_id": 12,
  "url": "https://example.com/video",
  "domain": "example.com",
  "title": "How Attention Works",
  "media_type": "video",
  "captured_at": "2026-04-03T12:00:00.000Z",
  "content_units": [
    {
      "unit_id": "transcript_1",
      "media_type": "video",
      "unit_type": "transcript_segment",
      "text": "Repeated exposure shapes attention.",
      "location": "Transcript or captions",
      "confidence": 0.82
    }
  ],
  "nodes": [
    {
      "id": "repeated_exposure",
      "label": "repeated exposure",
      "type": "concept",
      "count": 1
    }
  ],
  "edges": [
    {
      "from": "repeated_exposure",
      "to": "attention",
      "type": "shapes",
      "evidence": "Repeated exposure shapes attention.",
      "unit_id": "transcript_1",
      "confidence": 0.92,
      "extraction": "pattern"
    }
  ],
  "evidence_links": [
    {
      "evidence_id": "ev_mgc_12_attention_video_transcript_1",
      "packet_id": "mgc_12_attention_video",
      "unit_id": "transcript_1",
      "source_url": "https://example.com/video",
      "timestamp": "2026-04-03T12:00:00.000Z",
      "snippet": "Repeated exposure shapes attention.",
      "claim_supported": "captured_content",
      "score": 0.82
    }
  ],
  "schema_packets": [
    {
      "schema_id": "schema_mgc_12_attention_video_learning_research",
      "status": "captured_candidate",
      "category": "learning_research",
      "label": "Learning and research",
      "node_ids": ["repeated_exposure", "attention"],
      "edge_ids": ["edge_repeated_exposure_shapes_attention_1"],
      "evidence_ids": ["ev_mgc_12_attention_video_transcript_1"],
      "confidence": 0.58
    }
  ],
  "knowledge_graph": {
    "node_count": 2,
    "edge_count": 1,
    "nodes": [],
    "edges": []
  },
  "processing_jobs": []
}
```

Graph packets are deterministic local evidence envelopes. They do not claim
final origin, influence, pattern, or meaning by themselves. Inference, Schema,
Memory, and app-specific engines decide what survives and how it should be used
later.

`schema_packets` are captured candidates only. They group local nodes, edges,
and evidence IDs into a memory-ready envelope so Schema can later decide what
should become durable cognitive-schema memory.

Raw audio/video blobs are not part of this contract. When transcript text is missing, Capture exposes a pending local media job so a future local helper can transcribe without forcing Capture clients to handle media files.

## Sensitive Capture Exclusions

Capture must skip sensitive activity before graph formation.

Blocked categories include:

- banking, payment, checkout, and billing pages
- password, login, reset, OTP, and authentication pages
- private inboxes, direct messages, and compose pages
- medical, hospital, patient portal, and health-record pages
- account/admin pages where private user state is likely visible

These exclusions happen before content units, nodes, or edges are retained.

## Device Graph Packet Shape

The optional local Capture Helper exposes device-level packets for activity the browser extension cannot reliably see.

```json
{
  "packet_id": "dgc_12_code_abc123",
  "packet_type": "device_graph_capture",
  "schema_version": 1,
  "source": "device_helper",
  "url": "memact-device://window/code",
  "domain": "device",
  "title": "README.md - Visual Studio Code",
  "media_type": "device_window",
  "captured_at": "2026-04-03T12:00:00.000Z",
  "content_units": [
    {
      "unit_id": "window_title",
      "media_type": "device_window",
      "unit_type": "active_window_title",
      "text": "README.md - Visual Studio Code",
      "location": "Active window",
      "confidence": 0.82
    }
  ],
  "nodes": [],
  "edges": [],
  "processing_jobs": []
}
```

Device packets follow the same rule as browser packets: they are evidence, not conclusions. They should help downstream systems notice what was visible or active, especially when browser DOM access misses ads, desktop apps, documents, terminals, or local tools.

The helper does not retain raw screenshots or audio. Optional OCR uses temporary screenshots only during processing, then deletes them.

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

The nested `events` array is especially useful for downstream evidence-first
systems such as Inference, Schema, Memory, and app-specific query engines
because it preserves the page/domain/title trail behind a higher-level activity.

## Evidence Fields

Downstream engines should prefer these evidence fields when available:

- `url`
- `domain`
- `title`
- `occurred_at`
- `started_at`
- `ended_at`
- `content_text`
- `full_text`
- `display_full_text`
- `context_profile`
- `capture_packet`
- nested activity `events`

These fields are what let Memact answer with citations instead of unsupported summaries.

## Bridge Messages

These messages are now forwarded through `extension/memact/bridge.js`.

- `CAPTURE_GET_EVENTS`
- `CAPTURE_GET_SESSIONS`
- `CAPTURE_GET_ACTIVITIES`
- `CAPTURE_GET_CONTENT_UNITS`
- `CAPTURE_GET_GRAPH_PACKETS`
- `CAPTURE_GET_MEDIA_JOBS`
- `CAPTURE_GET_SNAPSHOT`
- `CAPTURE_BOOTSTRAP_HISTORY`
- `CAPTURE_BOOTSTRAP_STATUS`
- `CAPTURE_CLEAR_BOOTSTRAP_HISTORY`
- `MEMACT_STATUS`

Responses:

- `CAPTURE_GET_EVENTS_RESULT`
- `CAPTURE_GET_SESSIONS_RESULT`
- `CAPTURE_GET_ACTIVITIES_RESULT`
- `CAPTURE_GET_CONTENT_UNITS_RESULT`
- `CAPTURE_GET_GRAPH_PACKETS_RESULT`
- `CAPTURE_GET_MEDIA_JOBS_RESULT`
- `CAPTURE_GET_SNAPSHOT_RESULT`
- `CAPTURE_BOOTSTRAP_HISTORY_RESULT`
- `CAPTURE_BOOTSTRAP_STATUS_RESULT`
- `CAPTURE_CLEAR_BOOTSTRAP_HISTORY_RESULT`
- `MEMACT_STATUS_RESULT`

`MEMACT_STATUS` includes a lightweight sync signature:

```json
{
  "ready": true,
  "eventCount": 120,
  "sessionCount": 28,
  "graphPacketCount": 92,
  "contentUnitCount": 240,
  "pendingMediaJobCount": 3,
  "lastEventAt": "2026-04-25T05:00:00.000Z",
  "lastGraphPacketAt": "2026-04-25T05:00:02.000Z",
  "memorySignature": "120|28|92|240|3|2026-04-25T05:00:00.000Z|2026-04-25T05:00:02.000Z|complete|2026-04-25T04:58:00.000Z|54"
}
```

Clients should compare `memorySignature` before asking for `CAPTURE_GET_SNAPSHOT`.
If the signature did not change, the previous knowledge envelope is still current.

`MEMACT_STATUS` also includes optional helper state:

```json
{
  "device_helper": {
    "connected": true,
    "latest_seq": 12,
    "last_seen_at": "2026-04-03T12:00:00.000Z",
    "platform": "win32",
    "ocr_enabled": false,
    "raw_media_retained": false
  }
}
```

## Browser Runtime Export

When an authorized host is running with the extension bridge enabled, the page exposes a small runtime API:

That runtime is provided by `extension/memact/page-api.js`, which is injected into the page by `extension/memact/bridge.js`.

- `window.capture.getEvents({ limit })`
- `window.capture.getSessions({ limit })`
- `window.capture.getActivities({ limit })`
- `window.capture.getContentUnits({ limit })`
- `window.capture.getGraphPackets({ limit })`
- `window.capture.getMediaJobs({ limit })`
- `window.capture.getSnapshot({ limit })`
- `window.capture.getSnapshot({ limit, scopes })`
- `window.capture.exportSnapshot({ limit })`

`exportSnapshot()` is now an alias for `getSnapshot()` for developer compatibility. It does not write files.
`downloadSnapshot()` is intentionally disabled.

The capture layer does not download snapshots. Live products should use `MEMACT_STATUS`, `memorySignature`, and `CAPTURE_GET_SNAPSHOT` through the bridge so local evidence stays local and only moves when a Memact client requests it.
`MEMACT_STATUS.sync` reports `mode: "memory_pulse_bridge"` and `automaticDownloads: false` so clients can tell that automatic capture is running without a file-export loop.

## App Embed SDK

App developers can use the small browser client in `sdk/memact-capture-client.mjs`.
It verifies an API key with Access before reading the local Capture bridge:

```js
import { createMemactCaptureClient } from "./memact-capture-client.mjs";

const memact = createMemactCaptureClient({
  accessUrl: "https://memact-access.onrender.com",
  apiKey: "mka_key_shown_once"
});

const { snapshot } = await memact.getLocalSnapshot({
  scopes: ["capture:webpage", "schema:write", "graph:write", "memory:write", "memory:read_summary"]
});
```

More examples are in [`docs/embed-apps.md`](embed-apps.md).

This runtime is available by default on:

- `memact.com`
- localhost development hosts

It can also be enabled on any other authorized origin after the user explicitly grants access by clicking the extension action on that host once.

## Dependency Rule

- Capture must not import Inference, Schema, Website, or app-specific engines.
- Downstream engines may consume only the snapshot/activity contract above.
- No downstream engine may read `db.js`, `context-pipeline.js`, or other Capture internals directly.

## Platform Rule

Capture is the evidence source for every Memact client, not only the website.

Future Android capture should produce the same public snapshot shape:

- `events`
- `sessions`
- `activities`
- `content_units`
- `graph_packets`
- `pending_media_jobs`
- evidence fields such as `url`, `title`, `domain`, timestamps, and captured text

Future API explanation should never call Capture internals.
It should receive downstream evidence envelopes produced from this public contract.
