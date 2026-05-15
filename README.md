# Memact Capture

Version: `v0.0`

Capture is the evidence layer.

It owns one job:

```text
observe useful digital activity and store it as local evidence
```

Capture does not generate answers. It records what the user encountered and
wraps retained content in local evidence, nodes, edges, and schema packet
candidates so other Memact layers and approved apps can work from a real graph.

## What This Repo Owns

- Chrome/Chromium extension runtime.
- Optional local device helper for active app, window title, and visible UI text.
- Automatic page, tab, navigation, and interaction capture.
- Content extraction from webpages, PDFs, visible captions/transcripts, selections, and image context.
- Noise filtering for empty pages, auth screens, browser chrome, and low-value activity.
- Local IndexedDB storage for events, sessions, content units, graph packets, schema packet candidates, and media jobs.
- Public bridge APIs for Website and downstream engines.
- A small app embed SDK for scoped browser integrations.
- Extension packaging.

## Local Evidence Model

Capture stores several levels of evidence:

- `events`
  Individual useful activity records.

- `sessions`
  Time windows built from events.

- `activities`
  Higher-level activity groups built from sessions/events.

- `content_units`
  Captured text fragments such as article paragraphs, captions, transcript segments, PDF text, image captions, and selected text.

- `graph_packets`
  Local packets containing content units, extracted nodes, extracted edges, evidence links, schema packet candidates, and knowledge-graph metadata.

- `schema_packets`
  Candidate schema envelopes inside graph packets. They group node IDs, edge IDs,
  and evidence IDs, but they are not final durable schemas until the Schema layer
  confirms them.

- `media_jobs`
  Local OCR/ASR job descriptors. These are not raw media files.

## Device And Multimedia Boundary

Capture is automatic and local-first.

It does not:

- download snapshots to the user's Downloads folder
- show capture popups while browsing
- store raw audio/video blobs
- send captured media to the cloud

For video/audio, Capture first looks for captions, transcript text, and page context. If transcript text is missing, it records a local ASR job descriptor for a future helper.

For images, Capture stores alt text, captions, filenames, nearby section context, and OCR job descriptors for likely text-heavy images.

For device context, the optional Capture Helper samples the active app, active window title, and visible UI text available through Windows UI Automation. Optional OCR is off by default and uses temporary screenshots only during processing.

## Privacy Boundary

Capture must reject sensitive pages before they become events, content units,
nodes, or edges.

Sensitive categories include:

- banking and payments
- passwords, login, reset, OTP, and authentication pages
- private inboxes, direct messages, and compose screens
- medical or patient portals
- checkout, billing, and account pages

Those pages are skipped instead of being turned into graph evidence.

## Access Boundary

Apps do not receive a user's raw Memact memory graph by default.

Access creates API keys and consent scopes. Capture can return scoped snapshots:

- capture/schema write scopes let an app ask Memact to capture and form memory
- `memory:read_summary` allows compact summaries
- `memory:read_evidence` allows evidence snippets and source cards
- `memory:read_graph` is required before nodes and edges are exposed

Without graph-read scope, graph packets return counts and metadata only.

Activity categories also matter. The Capture SDK sends the app's approved
categories to Access during verification and passes them to the local bridge.
The bridge filters snapshot records by category before scope redaction, so a
news article wrapper asks for article evidence and does not receive unrelated
developer, shopping, media, or assistant activity.

## App Embed

Apps can plug into Memact through Access and the local Capture bridge. The helper
client lives in:

```text
sdk/memact-capture-client.mjs
```

Minimal integration:

```js
import { createMemactCaptureClient } from "./memact-capture-client.mjs";

const memact = createMemactCaptureClient({
  accessUrl: "https://memact-access.onrender.com",
  apiKey: "mka_key_shown_once"
});

const { snapshot } = await memact.getLocalSnapshot({
  scopes: ["capture:webpage", "schema:write", "graph:write", "memory:write", "memory:read_summary"],
  categories: ["web:news"]
});
```

See [`docs/embed-apps.md`](docs/embed-apps.md) for the full app flow.

## Public API

Downstream code should use only the public contract in [`docs/api-contract.md`](docs/api-contract.md).

Page API:

```js
await window.capture.getEvents({ limit: 3000 });
await window.capture.getSessions({ limit: 3000 });
await window.capture.getActivities({ limit: 3000 });
await window.capture.getContentUnits({ limit: 1200 });
await window.capture.getGraphPackets({ limit: 400 });
await window.capture.getMediaJobs({ limit: 200 });
await window.capture.getSnapshot({ limit: 3000 });
```

`exportSnapshot()` is kept as an alias for `getSnapshot()`. It returns data; it does not write a file.

## Run Locally

Prerequisites:

- Node.js `20+`
- npm `10+`
- Chrome, Edge, or another Chromium browser

Install:

```powershell
npm install
```

Validate:

```powershell
npm run check
```

Run the local device helper:

```powershell
npm run device-helper
```

Run one helper sample:

```powershell
npm run device-helper:once
```

Build extension zip:

```powershell
npm run build
```

The zip is created at:

```text
artifacts/memact-extension.zip
```

Load unpacked:

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable Developer Mode.
3. Click `Load unpacked`.
4. Select `extension/memact/`.

## Verify Capture

After loading the extension, browse normally. Then open an authorized Memact page and run:

```js
const snapshot = await window.capture.getSnapshot({ limit: 50 });
console.log(snapshot.events.length);
console.log(snapshot.graph_packets[0]);
```

Each graph packet now includes:

- `evidence_links`
- `knowledge_graph.nodes`
- `knowledge_graph.edges`
- `schema_packets`

That is the Capture-side contract for turning allowed activity into schema graph
memory without exposing raw graph data by default.

If the local helper is running, `window.capture.getSnapshot()` will also include `device_graph_capture` packets after the extension imports them.

## Security Notes

- The bridge is restricted to authorized Memact origins.
- Memory pulses contain counts and signatures, not captured page content.
- Broad host access is used for observation only.
- Raw media is not stored by the extension.
- The local helper listens on `127.0.0.1` and does not expose raw screenshots/audio.
- The helper does not enable browser CORS, so random webpages cannot read the local packet feed.

## License

See `LICENSE`.
