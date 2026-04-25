# Memact Capture

Version: `v0.0`

Capture is the observation layer in the Memact architecture.

It answers:

`What did the user encounter?`

This repository contains the browser extension, event capture pipeline, context extraction, storage, session/activity grouping, and the public snapshot API consumed by downstream Memact engines.

Capture is the evidence layer for Memact's citation and answer engine. Its job is to preserve enough website-consumption context that downstream systems can later answer with citations instead of guessing.

## Pipeline Position

```text
Capture -> Inference -> Schema -> Interface / Query -> Influence / Origin
```

Capture does not interpret thoughts. It records evidence.

## First-Use Bootstrap

Capture can seed the local store on first use with a limited import of recent browser history. This prevents downstream layers from starting completely empty.

- The import stays local to the extension.
- It creates deterministic metadata-based event records.
- The user must explicitly allow it from the Interface popup.
- It can be requested again through the bridge.
- It can be cleared separately without deleting future captured activity.
- Those imported events are a starting layer until richer live capture takes over.

## What Capture Does

- captures browser activity
- extracts page context and content from websites the user consumes
- filters noisy or low-value events
- stores local event history
- builds sessions and activity groups
- exports structured snapshots
- ranks searches with local sentence-transformer embeddings
- exposes local bridge APIs for downstream engines without automatic file downloads

## Website Evidence Captured

For supported pages, Capture stores the evidence needed for later citation:

- URL, domain, title, page description, and timestamps
- active tab, window, navigation, and route-change signals
- dwell/visibility signals that show the page was actually consumed
- scroll, typing, text selection, media playback, and content-mutation signals
- snippets, cleaned page text, display text, and full extracted text where available
- structured context profiles with topics, entities, page purpose, and capture intent
- capture packets with important blocks, points, search terms, and source metadata
- nested event trails inside activities so later answers can cite the original source

Capture should collect enough useful context for citation while still filtering obvious noise, empty pages, auth screens, and low-value browser chrome.

## What Capture Does Not Do

- infer cognitive schemas
- decide what shaped a thought
- generate answers
- generate influence claims
- own the product interface

Those concerns belong to Inference, Schema, Interface, Influence, and Origin.

## Public Integration Surface

Downstream systems should consume Capture only through the public snapshot/API boundary.

Primary surface:

- `extension/memact/capture-api.js`
- `docs/api-contract.md`

Public functions:

- `getEvents({ limit })`
- `getSessions({ limit })`
- `getActivities({ limit })`
- `getCaptureSnapshot({ limit })`

Runtime bridge messages also expose:

- `MEMACT_STATUS`
  Returns counts, extension state, bootstrap state, and a lightweight `memorySignature`.
- `CAPTURE_BOOTSTRAP_HISTORY`
  Starts local first-use browser activity import.
- `CAPTURE_CLEAR_BOOTSTRAP_HISTORY`
  Clears only browser-imported seed memories.

Clients should use `memorySignature` before requesting a full snapshot so they do not repeatedly move the same captured data.

## Snapshot Access

Capture snapshots contain:

- `events`
- `sessions`
- `activities`

Capture stores activity locally inside the extension. It does not download captured snapshots to the user's Downloads folder.

Downstream systems should use the bridge API and `memorySignature` to request data only when the local memory changed.
This is the automatic path for the product: Capture keeps recording useful activity, and clients sync through the bridge instead of watching downloaded files.

Developer snapshot reads are still available from an authorized page:

```js
await window.capture.getSnapshot({
  limit: 3000,
});
```

`window.capture.exportSnapshot({ limit })` is kept as a compatibility alias for `getSnapshot()`.
It returns the snapshot object and does not write a file.

## Terminal Quickstart

Prerequisites:

- Node.js `20+`
- npm `10+`
- a Chromium-based browser for extension loading

Install dependencies:

```powershell
npm install
```

Run validation:

```powershell
npm run check
```

Package the extension:

```powershell
npm run package-extension
```

The packaged extension is written to:

```text
artifacts/memact-extension.zip
```

Load locally:

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable Developer Mode.
3. Click `Load unpacked`.
4. Select `extension/memact/` or the extracted package folder.

If Memact Interface is running, it can also offer the ready-to-download zip from:

```text
public/memact-extension.zip
```

## Verify Capture

After loading the extension, browse normally and interact with real pages.

Capture refreshes on:

- navigation
- SPA route changes
- tab/window focus changes
- visible page dwell
- meaningful content mutations
- media playback
- scroll, typing, and text selection activity

To inspect a snapshot from an authorized page:

```js
const snapshot = await window.capture.getSnapshot({ limit: 50 });
console.log(snapshot.activities[0]);
```

## Downstream Flow

The intended local pipeline is:

```powershell
cd ..\website
npm run dev
```

Website / Query should ask Capture through the extension bridge. If a file-based run is needed for debugging, create a manual snapshot export first, then feed that file into Inference and Schema.

## Repository Layout

- `extension/memact/`
  Core extension runtime, capture pipeline, storage, session/activity model, and bridge.
- `docs/api-contract.md`
  Public Capture contract.
- `scripts/sync-transformers.mjs`
  Syncs extension vendor assets.
- `scripts/package-extension.mjs`
  Packages the extension into `artifacts/memact-extension.zip`.

## Embedding And Reuse

Capture is reusable inside Memact-controlled projects through its public API and snapshot contract.

The current license is proprietary. It is not licensed for open third-party embedding or redistribution.

## License

See `LICENSE`.
