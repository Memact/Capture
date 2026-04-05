function normalizeHostname(hostname) {
  return String(hostname || "")
    .toLowerCase()
    .replace(/^\[/, "")
    .replace(/\]$/, "");
}

function isLocalMemactHost(hostname) {
  const normalized = normalizeHostname(hostname);
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "0.0.0.0" ||
    normalized === "::1"
  );
}

function isMemactOrigin() {
  return (
    /(^|\.)memact\.com$/i.test(location.hostname) ||
    isLocalMemactHost(location.hostname)
  );
}

function forwardToPage(message) {
  window.postMessage(message, "*");
}

function injectPageApi() {
  if (!isMemactOrigin()) {
    return;
  }
  if (document.documentElement?.dataset?.captanetPageApi === "ready") {
    return;
  }

  try {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("page-api.js");
    script.async = false;
    script.dataset.captanetPageApi = "true";
    script.addEventListener("load", () => {
      try {
        document.documentElement.dataset.captanetPageApi = "ready";
      } catch (_) {
        // Ignore DOM marker failures.
      }
      script.remove();
    });
    script.addEventListener("error", () => {
      script.remove();
    });
    (document.head || document.documentElement).appendChild(script);
  } catch (_) {
    // Ignore injection failures and keep the bridge passive.
  }
}

function isBridgeRequestType(type) {
  return typeof type === "string" && (type.startsWith("MEMACT_") || type.startsWith("CAPTANET_"));
}

function announceReady() {
  try {
    document.documentElement.dataset.memactBridge = "ready";
  } catch (_) {
    // Ignore DOM marker failures.
  }
  forwardToPage({ type: "MEMACT_EXTENSION_READY" });
}

window.addEventListener("message", async (event) => {
  if (!isMemactOrigin()) {
    return;
  }
  if (event.source !== window) {
    return;
  }
  if (!isBridgeRequestType(event.data?.type)) {
    return;
  }

  const { type, payload, requestId } = event.data;

  try {
    if (type === "MEMACT_SEARCH") {
      const results = await chrome.runtime.sendMessage({
        type: "search",
        query: payload?.query || "",
        limit: payload?.limit || 20
      });
      forwardToPage({
        type: "MEMACT_SEARCH_RESULT",
        results,
        requestId
      });
    } else if (type === "MEMACT_SUGGESTIONS") {
      const results = await chrome.runtime.sendMessage({
        type: "suggestions",
        query: payload?.query || "",
        timeFilter: payload?.timeFilter || null,
        limit: payload?.limit || 6
      });
      forwardToPage({
        type: "MEMACT_SUGGESTIONS_RESULT",
        results,
        requestId
      });
    } else if (type === "MEMACT_STATUS") {
      const status = await chrome.runtime.sendMessage({ type: "status" });
      forwardToPage({
        type: "MEMACT_STATUS_RESULT",
        status,
        requestId
      });
    } else if (type === "CAPTANET_GET_EVENTS") {
      const response = await chrome.runtime.sendMessage({
        type: "captanetGetEvents",
        limit: payload?.limit || 3000
      });
      forwardToPage({
        type: "CAPTANET_GET_EVENTS_RESULT",
        response,
        requestId
      });
    } else if (type === "CAPTANET_GET_SESSIONS") {
      const response = await chrome.runtime.sendMessage({
        type: "captanetGetSessions",
        limit: payload?.limit || 3000
      });
      forwardToPage({
        type: "CAPTANET_GET_SESSIONS_RESULT",
        response,
        requestId
      });
    } else if (type === "CAPTANET_GET_ACTIVITIES") {
      const response = await chrome.runtime.sendMessage({
        type: "captanetGetActivities",
        limit: payload?.limit || 3000
      });
      forwardToPage({
        type: "CAPTANET_GET_ACTIVITIES_RESULT",
        response,
        requestId
      });
    } else if (type === "CAPTANET_GET_SNAPSHOT") {
      const response = await chrome.runtime.sendMessage({
        type: "captanetGetSnapshot",
        limit: payload?.limit || 3000
      });
      forwardToPage({
        type: "CAPTANET_GET_SNAPSHOT_RESULT",
        response,
        requestId
      });
    } else if (type === "MEMACT_STATS") {
      const stats = await chrome.runtime.sendMessage({ type: "stats" });
      forwardToPage({
        type: "MEMACT_STATS_RESULT",
        stats,
        requestId
      });
    } else if (type === "MEMACT_CLEAR_ALL_DATA") {
      const response = await chrome.runtime.sendMessage({ type: "clearAllData" });
      forwardToPage({
        type: "MEMACT_CLEAR_ALL_DATA_RESULT",
        response,
        requestId
      });
    } else if (type === "MEMACT_BRAIN_QUERY") {
      const response = await chrome.runtime.sendMessage({
        type: "brainQuery",
        query: payload?.query || "",
        sessionId: payload?.sessionId || "default",
        requestId
      });
      forwardToPage({
        type: "MEMACT_BRAIN_QUERY_ACK",
        response,
        requestId
      });
    } else if (type === "MEMACT_BRAIN_STATUS") {
      const response = await chrome.runtime.sendMessage({
        type: "brainStatus"
      });
      forwardToPage({
        type: "MEMACT_BRAIN_STATUS_RESULT",
        response,
        requestId
      });
    } else if (type === "MEMACT_BRAIN_WARM") {
      const response = await chrome.runtime.sendMessage({
        type: "brainWarm"
      });
      forwardToPage({
        type: "MEMACT_BRAIN_WARM_RESULT",
        response,
        requestId
      });
    } else if (type === "MEMACT_BRAIN_STOP") {
      const response = await chrome.runtime.sendMessage({
        type: "brainStop",
        targetRequestId: payload?.targetRequestId || ""
      });
      forwardToPage({
        type: "MEMACT_BRAIN_STOP_RESULT",
        response,
        requestId
      });
    } else if (type === "MEMACT_BRAIN_CLEAR_SESSION") {
      const response = await chrome.runtime.sendMessage({
        type: "brainClearSession",
        sessionId: payload?.sessionId || "default"
      });
      forwardToPage({
        type: "MEMACT_BRAIN_CLEAR_SESSION_RESULT",
        response,
        requestId
      });
    }
  } catch (error) {
    forwardToPage({
      type: "MEMACT_ERROR",
      error: String(error?.message || error || "bridge failed"),
      requestId
    });
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (!message?.type?.startsWith?.("MEMACT_BRAIN_")) {
    return;
  }

  forwardToPage(message);
});

injectPageApi();
announceReady();
window.addEventListener("DOMContentLoaded", announceReady, { once: true });
setTimeout(announceReady, 150);
setTimeout(announceReady, 500);
setTimeout(announceReady, 1200);
setTimeout(announceReady, 2500);
setTimeout(injectPageApi, 150);
setTimeout(injectPageApi, 500);
setTimeout(injectPageApi, 1200);
