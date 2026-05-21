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

This repo includes a small app-event ingestion path:

- `normalizeCaptureEvent(input, defaults)`
- `validateCaptureEvent(input)`
- `redactSensitivePayload(event)`
- `shouldSkipSensitiveEvent(event)`
- `ingestAppCaptureEvent(event, options)`
- in-memory capture store helpers for tests and local development

It does not yet own a hosted production database. Access can store accepted
events today so gateway behavior can be verified while Capture remains the
source of truth for event shape and privacy handling.

## Development

```powershell
npm install
npm run check
```
