# Memact description

**Permissioned intent infrastructure for apps.**

```text
Understand what users are trying to do.
```

Memact is infrastructure that helps apps predict user intent from approved digital activity, without giving them raw access to a user's private data.

This repo is the Capture layer. It records useful approved digital activity as local evidence that downstream Memact layers can understand, group, predict from, and store.

## System position

```text
Website manages -> Access gates -> Capture records -> Inference understands -> Schema groups -> Intent predicts -> Memory stores -> Apps consume
```

Capture is local evidence collection. It does not produce semantic meaning, durable schemas, final intent predictions, memory survival decisions, or app-facing retrieval.

## What this repo owns

- browser/page activity capture
- useful local evidence
- events, sessions, and content units
- source metadata, timestamps, and activity category hints
- local media, OCR, and ASR job descriptors
- privacy skips before activity becomes evidence
- compatibility evidence packets for downstream layers

## What this repo does not own

- final semantic understanding
- durable nodes and edges as authority
- final schema packets
- intent prediction
- long-term memory storage or retrieval

If older code mentions graph packets, treat them as raw evidence packets or extraction hints. Schema and Memory own durable schema/memory authority.

## Copy rules

Use:

- "Permissioned intent infrastructure for apps."
- "Understand what users are trying to do."
- "approved digital activity"
- "local evidence"
- "sensitive activity is skipped before downstream processing"

Avoid:

- generic AI wrapper language
- vague memory-plugin language
- raw-data export framing
- claims that apps get the whole memory graph
- open-source wording unless the repo license explicitly says so
