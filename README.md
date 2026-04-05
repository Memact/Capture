# Captanet

Captanet is the foundation memory engine behind Memact.

Version: `v0.0`

It answers:

`What happened?`

This `main` branch is intentionally foundation-only.

It contains the capture pipeline, storage layer, session/activity builder, and the extension-side API surface that downstream systems consume. The Memact website shell is not kept on this branch anymore.

## What Stays In Captanet

- browser activity capture
- noise filtering and capture intent
- context extraction
- selective memory and retention scoring
- local event storage
- session detection
- semantic activity grouping
- structured snapshot export
- extension bridge messages for approved Memact hosts

## Capture Behavior

Captanet captures more than URLs and titles.

For supported pages it extracts and stores:

- page title and description
- selected text
- snippet text
- cleaned full page text
- structured context fields such as subject, entities, topics, and capture packet blocks

Capture is triggered on:

- page load and completed navigation
- tab activation and focused-window changes
- debounced user interaction on the current page
  this now includes scrolling, typing, and text selection so the extension can capture updated page context instead of only first-load metadata

## What Does Not Stay Here

- website UI
- static website assets
- Vite app shell
- branding/media for the marketing site
- web deployment scaffolding

Those were split away from `main` to keep Captanet usable as a clean foundation repository.

## Branch Layout

- `main`
  Foundation-only Captanet code.
- `website`
  Preserved website shell branch for the current Memact web experience.

The idea is simple:

- website code may depend on Captanet
- Captanet should not carry website files in `main`

## Public Integration Surface

Captanet should be integrated through its public contract, not by reaching into internals.

Primary surface:

- `extension/memact/captanet-api.js`
- `docs/api-contract.md`

Public functions:

- `getEvents({ limit })`
- `getSessions({ limit })`
- `getActivities({ limit })`
- `getCaptanetSnapshot({ limit })`

## Snapshot Export

Captanet exposes a deterministic snapshot contract for downstream consumers such as Influnet.

That contract contains:

- `events`
- `sessions`
- `activities`

Influnet and future consumers should use this export boundary instead of importing `db.js`, `context-pipeline.js`, or other internal modules directly.

## Repository Layout

- `extension/memact/`
  Core extension runtime, capture pipeline, storage, session/activity model, and bridge.
- `docs/api-contract.md`
  Public Captanet contract.
- `scripts/sync-transformers.mjs`
  Syncs extension vendor assets from installed dependencies.
- `scripts/package-extension.mjs`
  Packages the extension into `artifacts/memact-extension.zip`.

## Terminal Quickstart

Prerequisites:

- Node.js `20+`
- npm `10+`
- a Chromium-based browser if you want to load the extension locally

Install dependencies:

```powershell
npm install
```

Run the repository validation pass:

```powershell
npm run check
```

Package the extension artifact:

```powershell
npm run package-extension
```

The packaged extension zip is written to:

```text
artifacts/memact-extension.zip
```

Load the extension for local use:

1. Run `npm run package-extension`.
2. Extract `artifacts/memact-extension.zip` to a local folder.
3. Open `chrome://extensions` or `edge://extensions`.
4. Enable Developer Mode.
5. Click `Load unpacked`.
6. Select the extracted extension folder.

If you are iterating on the source directly, you can also load:

```text
extension/memact/
```

Manual vendor refresh remains available when needed:

```powershell
npm run sync-vendors
```

`npm run build` is intentionally the same packaging step as `npm run package-extension`.

## Website Relationship

The extension still recognizes approved Memact hosts and can bridge to a Memact website runtime.

That coupling is part of the runtime contract, but the website implementation itself no longer lives on this branch.

Captanet can also expose its page runtime on arbitrary websites, but only after you explicitly authorize the current origin by clicking the extension icon on that site once.

## Hand Off To Influnet

Captanet is the capture and memory side of the stack. A common workflow is:

1. Run Captanet and let it collect activity.
2. On `memact.com`, localhost, or any site you have explicitly authorized, export a snapshot through the bridge runtime:

```js
await window.captanet.exportSnapshot({
  limit: 3000,
});
```

By default that export is written into the workspace root as:

```text
C:\Users\sujay\Downloads\memact_ai\captanet-snapshot.json
```

3. Analyze that exported file with Influnet:

```powershell
cd ..\influnet
npm run analyze -- --input <path-to-captanet-snapshot.json> --format report
```

This keeps the dependency direction clean:

- Captanet captures and structures the memory stream
- Influnet interprets the exported structure without touching Captanet internals

## Verify Content Capture

After loading the extension, open a few real pages and interact with them for a few seconds by scrolling, selecting text, or typing.

Then export a snapshot from a bridge-enabled Memact host:

```js
const snapshot = await window.captanet.exportSnapshot({
  limit: 3000,
  download: false,
});

console.log(snapshot.events[0]);
```

You should see populated fields such as:

- `content_text`
- `full_text`
- `display_full_text`
- `context_profile`
- `capture_packet`

If `full_text` is consistently empty on a page, that page is either blocked from scripted capture, intentionally reduced to structured memory, or filtered as low-value/noisy content by Captanet's retention logic.

## Authorize Any Website

If you want to use the page runtime on a site other than `memact.com` or localhost:

1. Open that website.
2. Click the Captanet extension icon once.
3. Refresh the page.
4. Open DevTools and run:

```js
await window.captanet.waitUntilReady()
```

After that, the same runtime API is available on that authorized origin:

```js
await window.captanet.getSnapshot({ limit: 50 })
```

If you want the file export explicitly:

```js
await window.captanet.downloadSnapshot({
  limit: 3000,
  filename: "memact_ai/captanet-snapshot.json",
})
```

This is intentionally explicit. Captanet does not expose your memory API to every visited site by default.

## Embedding And Reuse

Technical answer:

- yes, Captanet is structured to be reused across future Memact-controlled projects
- the stable reuse boundary is its API/snapshot contract
- new projects should consume snapshots or the exported API, not copy foundation code into product shells

License answer:

- the current license is proprietary
- you can reuse Captanet inside your own Memact-controlled projects
- it is not currently licensed for open third-party embedding or redistribution

## License

This repository uses the same license text as the original Memact codebase.

See `LICENSE`.
