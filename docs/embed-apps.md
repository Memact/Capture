# Embedding Memact Capture In Apps

Apps should use Memact to capture allowed activity and form schema graph
packets. They should not receive the user's raw memory graph unless the user
grants graph-read scope.

## Browser App Flow

```text
user installs Capture
-> user signs in to Memact
-> app is registered in Access
-> user grants scopes for that app
-> app receives an API key
-> app verifies scope with Access
-> app reads only the allowed local Capture snapshot
```

## Minimal Browser Integration

Copy `sdk/memact-capture-client.mjs` into your app or import it from this repo
while developing.

```js
import { createMemactCaptureClient } from "./memact-capture-client.mjs";

const memact = createMemactCaptureClient({
  accessUrl: "https://memact-access.onrender.com",
  apiKey: "mka_key_shown_once"
});

const { snapshot } = await memact.getLocalSnapshot({
  limit: 1000,
  scopes: [
    "capture:webpage",
    "schema:write",
    "graph:write",
    "memory:write",
    "memory:read_summary"
  ]
});

console.log(snapshot.counts);
```

## Reading Graph Objects

Graph reads require explicit consent:

```js
const { graph_packets } = await memact.getGraphPackets({
  scopes: ["memory:read_graph"]
});
```

Without `memory:read_graph`, Capture returns counts and metadata instead of
nodes and edges.

## What Apps Receive By Default

By default, apps receive:

- activity counts
- capture status
- compact summaries where permitted
- schema formation permission if the user grants `schema:write`
- graph write permission if the user grants `graph:write`

Apps do not receive:

- raw graph objects
- source snippets
- private pages
- passwords, banking, medical, checkout, inbox, or direct-message content

## Scope Guide

- `capture:webpage`
  Lets Memact capture useful webpage context for this app.

- `capture:media`
  Lets Memact capture captions, transcripts, and media context when available.

- `capture:device`
  Lets Memact receive allowed OS-level activity from the local helper.

- `schema:write`
  Lets Memact form schema packets from retained evidence.

- `graph:write`
  Lets Memact store local nodes, edges, and evidence links.

- `memory:write`
  Lets Memact persist retained graph evidence as memory.

- `memory:read_summary`
  Lets the app read compact memory summaries.

- `memory:read_evidence`
  Lets the app read evidence snippets and source cards.

- `memory:read_graph`
  Lets the app read permitted nodes and edges.

## Security Boundary

The API key is a permission key. It is not a memory dump key.

Capture validates the app key with Access, applies the user's scopes, blocks
sensitive sources before storage, and redacts accidental private values before
content becomes graph evidence.
