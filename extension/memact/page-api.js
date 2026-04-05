(function installCaptanetPageApi() {
  if (window.captanet) {
    return;
  }

  const pendingRequests = new Map();
  let bridgeReady = false;
  let requestCounter = 0;

  function nextRequestId(prefix = "captanet") {
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
        reject(new Error("Captanet bridge is not ready on this page."));
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
    link.download = filename || "captanet-snapshot.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
        reject(new Error(String(data.error || "Captanet bridge failed.")));
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

  async function expectCaptanetResponse(type, payload = {}) {
    const result = await requestBridge(type, payload);
    const response = result?.response;
    if (!response?.ok) {
      throw new Error(String(response?.error || `${type} failed.`));
    }
    return response;
  }

  window.captanet = {
    isReady() {
      return bridgeReady;
    },
    waitUntilReady(timeoutMs = 4000) {
      return waitForBridgeReady(timeoutMs).then(() => true);
    },
    async getEvents(options = {}) {
      const response = await expectCaptanetResponse("CAPTANET_GET_EVENTS", options);
      return Array.isArray(response.events) ? response.events : [];
    },
    async getSessions(options = {}) {
      const response = await expectCaptanetResponse("CAPTANET_GET_SESSIONS", options);
      return Array.isArray(response.sessions) ? response.sessions : [];
    },
    async getActivities(options = {}) {
      const response = await expectCaptanetResponse("CAPTANET_GET_ACTIVITIES", options);
      return Array.isArray(response.activities) ? response.activities : [];
    },
    async getSnapshot(options = {}) {
      const response = await expectCaptanetResponse("CAPTANET_GET_SNAPSHOT", options);
      return response.snapshot || null;
    },
    async exportSnapshot(options = {}) {
      const {
        limit = 3000,
        filename = "captanet-snapshot.json",
        download = true,
      } = options || {};
      const snapshot = await this.getSnapshot({ limit });
      if (!snapshot) {
        throw new Error("Captanet did not return a snapshot.");
      }
      if (download) {
        downloadJson(filename, snapshot);
      }
      return snapshot;
    },
  };

  window.dispatchEvent(
    new CustomEvent("captanet-ready", {
      detail: {
        bridgeReady: () => bridgeReady,
      },
    })
  );
})();
