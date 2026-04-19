# Memact Capture

Version: `v0.0`

Capture is the observation layer in the Memact architecture.

It answers:

`What did the user encounter?`

This repository contains the browser extension, event capture pipeline, context extraction, storage, session/activity grouping, and the public snapshot API consumed by downstream Memact engines.

## Pipeline Position

```text
Capture -> Inference -> Schema -> Interface / Query -> Origin + Influence
```

Capture does not interpret thoughts. It records evidence.

## What Capture Does

- captures browser activity
- extracts page context and content where available
- filters noisy or low-value events
- stores local event history
- builds sessions and activity groups
- exports structured snapshots
- maintains a rolling autosaved snapshot for downstream engines

## What Capture Does Not Do

- infer cognitive schemas
- decide what shaped a thought
- generate influence claims
- own the product interface

Those concerns belong to Inference, Schema, Origin, Influence, and Interface.

## Public Integration Surface

Downstream systems should consume Capture only through the public snapshot/API boundary.

Primary surface:

- `extension/memact/capture-api.js`
- `docs/api-contract.md`

Compatibility note:

The runtime object is still named `window.capture` and the snapshot files are still named `capture-snapshot-*.json` for extension compatibility. The public product/repo name is now `Capture`.

Public functions:

- `getEvents({ limit })`
- `getSessions({ limit })`
- `getActivities({ limit })`
- `getCaptureSnapshot({ limit })`

## Snapshot Export

Capture snapshots contain:

- `events`
- `sessions`
- `activities`

The extension automatically refreshes a rolling snapshot while it captures:

```text
C:\Users\sujay\Downloads\memact_ai\capture-snapshot-latest.json
```

Manual archive exports are still available from an authorized page:

```js
await window.capture.exportSnapshot({
  limit: 3000,
});
```

Manual exports are written as:

```text
C:\Users\sujay\Downloads\memact_ai\capture-snapshot-<timestamp>-<id>.json
```

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
cd ..\inference
npm run infer -- --input ..\capture-snapshot-latest.json --format json
```

Then feed the Inference output into Schema, Origin, Influence, or Interface.

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
