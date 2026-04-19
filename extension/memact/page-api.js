(function installCapturePageApi() {
  if (window.capture) {
    return;
  }

  const DEFAULT_SNAPSHOT_FILENAME = "memact_ai/capture-snapshot.json";
  const pendingRequests = new Map();
  let bridgeReady = false;
  let requestCounter = 0;

  function nextRequestId(prefix = "capture") {
    requestCounter += 1;
    return `${prefix}-${Date.now()}-${requestCounter}`;
  }

  function waitForBridgeReady(timeoutMs = 4000) {
    if (bridgeReady) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        window.removeEventListener("message", onReady);
        reject(new Error("Capture bridge is not ready on this page."));
      }, timeoutMs);

      function onReady(event) {
        if (event.source !== window) {
          return;
        }
        if (event.data?.type !== "MEMACT_EXTENSION_READY") {
          return;
        }
        bridgeReady = true;
        window.clearTimeout(timeoutId);
        window.removeEventListener("message", onReady);
        resolve();
      }

      window.addEventListener("message", onReady);
    });
  }

  function requestBridge(type, payload = {}, timeoutMs = 15000) {
    return waitForBridgeReady().then(
      () =>
        new Promise((resolve, reject) => {
          const requestId = nextRequestId(type.toLowerCase());
          const timeoutId = window.setTimeout(() => {
            pendingRequests.delete(requestId);
            reject(new Error(`Timed out waiting for ${type}.`));
          }, timeoutMs);

          pendingRequests.set(requestId, {
            resolve,
            reject,
            timeoutId,
          });

          window.postMessage(
            {
              type,
              payload,
              requestId,
            },
            "*"
          );
        })
    );
  }

  function finishPending(requestId, fn) {
    const entry = pendingRequests.get(requestId);
    if (!entry) {
      return;
    }
    pendingRequests.delete(requestId);
    window.clearTimeout(entry.timeoutId);
    fn(entry);
  }

  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || "capture-snapshot.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function buildUniqueFallbackFilename(filename) {
    const normalized = String(filename || DEFAULT_SNAPSHOT_FILENAME)
      .replace(/\\/g, "/")
      .split("/")
      .filter(Boolean)
      .at(-1) || "capture-snapshot.json";
    const extensionMatch = normalized.match(/(\.[A-Za-z0-9]+)$/);
    const extension = extensionMatch ? extensionMatch[1] : ".json";
    const stem = normalized.slice(0, normalized.length - extension.length) || "capture-snapshot";
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    const randomId =
      typeof crypto?.randomUUID === "function"
        ? crypto.randomUUID().replace(/-/g, "").slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
    return `${stem}-${timestamp}-${randomId}${extension}`;
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) {
      return;
    }

    const data = event.data || {};
    if (data.type === "MEMACT_EXTENSION_READY") {
      bridgeReady = true;
      return;
    }

    if (!data.requestId) {
      return;
    }

    if (data.type === "MEMACT_ERROR") {
      finishPending(data.requestId, ({ reject }) => {
        reject(new Error(String(data.error || "Capture bridge failed.")));
      });
      return;
    }

    if (!/_RESULT$/.test(String(data.type || ""))) {
      return;
    }

    finishPending(data.requestId, ({ resolve }) => {
      resolve(data);
    });
  });

  async function expectCaptureResponse(type, payload = {}) {
    const result = await requestBridge(type, payload);
    const response = result?.response;
    if (!response?.ok) {
      throw new Error(String(response?.error || `${type} failed.`));
    }
    return response;
  }

  window.capture = {
    isReady() {
      return bridgeReady;
    },
    waitUntilReady(timeoutMs = 4000) {
      return waitForBridgeReady(timeoutMs).then(() => true);
    },
    async getEvents(options = {}) {
      const response = await expectCaptureResponse("CAPTURE_GET_EVENTS", options);
      return Array.isArray(response.events) ? response.events : [];
    },
    async getSessions(options = {}) {
      const response = await expectCaptureResponse("CAPTURE_GET_SESSIONS", options);
      return Array.isArray(response.sessions) ? response.sessions : [];
    },
    async getActivities(options = {}) {
      const response = await expectCaptureResponse("CAPTURE_GET_ACTIVITIES", options);
      return Array.isArray(response.activities) ? response.activities : [];
    },
    async getSnapshot(options = {}) {
      const response = await expectCaptureResponse("CAPTURE_GET_SNAPSHOT", options);
      return response.snapshot || null;
    },
    async exportSnapshot(options = {}) {
      const {
        limit = 3000,
        filename = DEFAULT_SNAPSHOT_FILENAME,
        download = true,
        allowBrowserFallback = false,
      } = options || {};

      if (!download) {
        const snapshot = await this.getSnapshot({ limit });
        if (!snapshot) {
          throw new Error("Capture did not return a snapshot.");
        }
        return snapshot;
      }

      try {
        const response = await expectCaptureResponse("CAPTURE_EXPORT_SNAPSHOT", {
          limit,
          filename,
        });
        const snapshot = response.snapshot || null;
        if (!snapshot) {
          throw new Error("Capture did not return a snapshot.");
        }
        snapshot.export_meta = {
          saved_to: response.saved_to || filename,
          download_id: response.download_id || null,
          fallback_download: false,
        };
        return snapshot;
      } catch (error) {
        if (!allowBrowserFallback) {
          throw new Error(
            `Capture could not save the snapshot through the extension runtime. ${String(
              error?.message || error || "Export failed."
            )}`
          );
        }
        const snapshot = await this.getSnapshot({ limit });
        if (!snapshot) {
          throw new Error("Capture did not return a snapshot.");
        }
        const safeFilename = buildUniqueFallbackFilename(filename);
        downloadJson(safeFilename, snapshot);
        snapshot.export_meta = {
          saved_to: safeFilename,
          download_id: null,
          fallback_download: true,
        };
        return snapshot;
      }
    },
    async downloadSnapshot(options = {}) {
      const snapshot = await this.exportSnapshot(options);
      return snapshot?.export_meta || {
        saved_to: options?.filename || DEFAULT_SNAPSHOT_FILENAME,
        download_id: null,
      };
    },
  };

  window.dispatchEvent(
    new CustomEvent("capture-ready", {
      detail: {
        bridgeReady: () => bridgeReady,
      },
    })
  );
})();
