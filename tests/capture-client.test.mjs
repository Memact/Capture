import assert from "node:assert/strict";
import test from "node:test";
import { createBrowserEmbedSnippet, createMemactCaptureClient } from "../sdk/memact-capture-client.mjs";

test("capture client verifies access before reading local snapshot", async () => {
  const requests = [];
  const client = createMemactCaptureClient({
    accessUrl: "https://access.example",
    apiKey: "mka_test",
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return new Response(JSON.stringify({ allowed: true, scopes: ["memory:read_summary"] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
    captureRuntime: {
      async getSnapshot(options) {
        return {
          counts: { events: 1 },
          access_filter: { scopes: options.scopes },
        };
      },
    },
  });

  const result = await client.getLocalSnapshot({
    scopes: ["memory:read_summary"],
    categories: ["web:news"],
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://access.example/v1/access/verify");
  assert.deepEqual(JSON.parse(requests[0].options.body).activity_categories, ["web:news"]);
  assert.equal(result.snapshot.counts.events, 1);
  assert.deepEqual(result.snapshot.access_filter.scopes, ["memory:read_summary"]);
});

test("browser embed snippet shows the real integration shape", () => {
  const snippet = createBrowserEmbedSnippet({
    accessUrl: "https://access.example/",
    apiKey: "mka_demo",
    scopes: ["capture:webpage", "schema:write"],
    categories: ["web:news"],
  });

  assert.match(snippet, /createMemactCaptureClient/);
  assert.match(snippet, /getLocalSnapshot/);
  assert.match(snippet, /schema:write/);
  assert.match(snippet, /web:news/);
  assert.doesNotMatch(snippet, /raw memory dump/i);
});
