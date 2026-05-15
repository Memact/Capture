# Memact Local Helper

Version: `v0.0`

The local helper is the optional device evidence layer for Memact.

It observes useful device context that a browser extension cannot reliably see, then exposes small evidence packets to the Memact extension.

It does not keep raw screenshots or audio.

## What It Captures

- Active app name.
- Active window title.
- Visible app text available through Windows UI Automation.
- Optional ephemeral screen OCR when explicitly started with `--ocr`.

## What It Does Not Do

- It does not silently bypass OS permissions.
- It does not store raw screenshots.
- It does not record microphone audio.
- It does not send captured device activity to the cloud.

## Run Once

```powershell
npm --prefix native-helper run once
```

## Run As Local Helper

```powershell
npm --prefix native-helper run start
```

The helper listens on:

```text
http://127.0.0.1:38489
```

Capture polls this local endpoint and imports only new packets.
The helper does not enable browser CORS, so normal webpages cannot read the local packet feed.

## Optional OCR

OCR is off by default. To enable ephemeral OCR:

```powershell
node native-helper/src/helper.mjs --ocr
```

This requires `tesseract` to be installed and available on `PATH`. Temporary screenshots are deleted immediately after OCR.
