# Memact Capture

Capture records useful digital activity as evidence.

App/site integration is primary. The browser extension and local helper are
optional capture sources.

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
App/site using Memact -> SDK/API capture event -> Access verifies -> Capture records -> Inference
Optional extension/local helper -> Capture records -> Inference
No Memact integration -> no automatic capture unless the user shares, imports, connects, or enables the extension
```

## Development

```powershell
npm install
npm run check
```
