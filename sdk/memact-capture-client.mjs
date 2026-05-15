const DEFAULT_ACCESS_URL = "https://memact-access.onrender.com";

function normalizeUrl(value) {
  return String(value || DEFAULT_ACCESS_URL).replace(/\/+$/, "");
}

function normalizeScopes(scopes = []) {
  return [...new Set((Array.isArray(scopes) ? scopes : []).map(String).filter(Boolean))];
}

function normalizeCategories(categories = []) {
  return [...new Set((Array.isArray(categories) ? categories : []).map(String).filter(Boolean))];
}

async function readJson(response) {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = payload?.error?.message || `Memact request failed with ${response.status}.`;
    throw new Error(message);
  }
  return payload;
}

function resolveCaptureRuntime(runtime) {
  if (runtime) {
    return runtime;
  }
  if (typeof globalThis !== "undefined" && globalThis.capture) {
    return globalThis.capture;
  }
  throw new Error("Memact Capture is not available on this page. Install Capture and authorize this origin.");
}

export function createMemactCaptureClient({
  accessUrl = DEFAULT_ACCESS_URL,
  apiKey,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  captureRuntime = null,
} = {}) {
  if (!apiKey) {
    throw new Error("A Memact API key is required.");
  }
  if (!fetchImpl) {
    throw new Error("A fetch implementation is required.");
  }

  const baseUrl = normalizeUrl(accessUrl);

  async function verify(requiredScopes = [], activityCategories = []) {
    return readJson(
      await fetchImpl(`${baseUrl}/v1/access/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Memact-API-Key": apiKey,
        },
        body: JSON.stringify({
          required_scopes: normalizeScopes(requiredScopes),
          activity_categories: normalizeCategories(activityCategories),
        }),
      })
    );
  }

  async function getLocalSnapshot({
    limit = 1000,
    scopes = ["memory:read_summary"],
    categories = [],
    verifyAccess = true,
  } = {}) {
    const cleanScopes = normalizeScopes(scopes);
    const cleanCategories = normalizeCategories(categories);
    const access = verifyAccess ? await verify(cleanScopes, cleanCategories) : null;
    const runtime = resolveCaptureRuntime(captureRuntime);
    const snapshot = await runtime.getSnapshot({
      limit,
      scopes: cleanScopes,
      categories: cleanCategories,
      understandingStrategy: access?.understanding_strategy || null,
    });
    return {
      access,
      snapshot,
    };
  }

  async function getGraphPackets({
    limit = 200,
    scopes = ["memory:read_graph"],
    categories = [],
    verifyAccess = true,
  } = {}) {
    const cleanScopes = normalizeScopes(scopes);
    const cleanCategories = normalizeCategories(categories);
    const access = verifyAccess ? await verify(cleanScopes, cleanCategories) : null;
    const runtime = resolveCaptureRuntime(captureRuntime);
    const graphPackets = await runtime.getGraphPackets({
      limit,
      scopes: cleanScopes,
      categories: cleanCategories,
      understandingStrategy: access?.understanding_strategy || null,
    });
    return {
      access,
      graph_packets: graphPackets,
    };
  }

  return {
    verify,
    getLocalSnapshot,
    getGraphPackets,
  };
}

export function createBrowserEmbedSnippet({
  accessUrl = DEFAULT_ACCESS_URL,
  apiKey = "mka_replace_with_key_shown_once",
  scopes = ["capture:webpage", "schema:write", "graph:write", "memory:write", "memory:read_summary"],
  categories = ["web:news"],
  limit = 1000,
} = {}) {
  const cleanScopes = normalizeScopes(scopes);
  const cleanCategories = normalizeCategories(categories);
  return `import { createMemactCaptureClient } from "./memact-capture-client.mjs";

const memact = createMemactCaptureClient({
  accessUrl: "${normalizeUrl(accessUrl)}",
  apiKey: "${apiKey}"
});

const { snapshot } = await memact.getLocalSnapshot({
  limit: ${Number(limit) || 1000},
  scopes: ${JSON.stringify(cleanScopes)},
  categories: ${JSON.stringify(cleanCategories)}
});

console.log(snapshot.counts);`;
}
