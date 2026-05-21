# Memact Capture

Capture records useful digital activity as evidence.

Apps and sites can send events through the SDK/API after permission. The browser
extension and local helper are optional capture sources, not the only way
Memact works.

## Owns

- App/site capture events.
- Optional browser extension capture.
- Optional local helper capture.
- Imports and shared evidence normalization.
- Source metadata, timestamps, activity category hints, and privacy skips.

## Does Not Own

- Semantic understanding.
- Durable schema packets.
- Feature runtime.
- Memory storage decisions.
- API key verification.

## Flow

```text
App/site using Memact
-> SDK/API capture event
-> Access verifies
-> Capture records
-> Inference understands

Optional extension/local helper
-> Capture records
-> Inference understands

No Memact integration
-> no automatic capture unless the user shares, imports, connects, or enables the extension
```

## Current Code

This repo includes the extension at `extension/memact` and a small app-event
ingestion path:

- `normalizeCaptureEvent(input, defaults)`
- `validateCaptureEvent(input)`
- `redactSensitivePayload(event)`
- `shouldSkipSensitiveEvent(event)`
- `ingestAppCaptureEvent(event, options)`
- `extensionSnapshotToCaptureEvents(snapshot, defaults)`
- in-memory capture store helpers for tests and local development

The extension adapter is the bridge between the older browser extension capture
surface and the newer capture-event contract. Extension activity snapshots can
be normalized into the same `memact.capture_event.v0` events that apps/sites
send through the SDK/API.

It does not yet own a hosted production database. Access can store accepted
events today so gateway behavior can be verified while Capture remains the
source of truth for event shape and privacy handling.

## Development

```powershell
npm install
npm run check
```
