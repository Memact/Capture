const PRIMARY_MODEL_ID = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
const MODEL_LOAD_TIMEOUT_MS = 180000;
const GENERATION_START_TIMEOUT_MS = 90000;
const GENERATION_IDLE_TIMEOUT_MS = 45000;
const WARMUP_TIMEOUT_MS = 90000;
const MAX_OUTPUT_TOKENS = 280;

let engine = null;
let loadPromise = null;
let primePromise = null;
let webLlmModulePromise = null;
let primed = false;
let status = {
  ready: false,
  loading: false,
  progress: 0,
  text: "",
  error: "",
  fallbackMode: false,
  modelId: "",
  templateReason: "",
};
const subscribers = new Set();

function withTimeout(promise, timeoutMs, errorMessage) {
  let timer = null;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    }),
  ]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
}

function notifySubscribers() {
  for (const subscriber of subscribers) {
    try {
      subscriber(getBrainStatus());
    } catch {
      // Ignore subscriber failures so the engine stays healthy.
    }
  }
}

function updateStatus(patch) {
  status = {
    ...status,
    ...patch,
  };
  notifySubscribers();
}

function hasWebGPU() {
  return typeof navigator !== "undefined" && Boolean(navigator.gpu);
}

async function loadWebLlmModule() {
  if (!webLlmModulePromise) {
    webLlmModulePromise = import("./vendor/web-llm.mjs").catch((error) => {
      webLlmModulePromise = null;
      throw error;
    });
  }
  return webLlmModulePromise;
}

async function createAppConfig() {
  const { prebuiltAppConfig } = await loadWebLlmModule();
  return {
    ...prebuiltAppConfig,
    useIndexedDBCache: true,
    model_list: prebuiltAppConfig.model_list.slice(),
  };
}

async function tryLoadModel(modelId, appConfig) {
  const { CreateMLCEngine } = await loadWebLlmModule();
  updateStatus({
    loading: true,
    ready: false,
    fallbackMode: false,
    error: "",
    text: "Loading Memact...",
    progress: 0.02,
    templateReason: "",
  });

  const loadedEngine = await withTimeout(
    CreateMLCEngine(modelId, {
      appConfig,
      initProgressCallback(report) {
        updateStatus({
          loading: true,
          ready: false,
          progress: Math.max(0.02, Math.min(1, Number(report?.progress || 0))),
          text: String(report?.text || "Loading Memact..."),
          modelId,
        });
      },
    }),
    MODEL_LOAD_TIMEOUT_MS,
    "model_load_timeout"
  );

  engine = loadedEngine;
  updateStatus({
    loading: false,
    ready: true,
    progress: 1,
    text: "Memact is ready.",
    error: "",
    fallbackMode: false,
    modelId,
    templateReason: "",
  });
  return loadedEngine;
}

async function primeEngine(loadedEngine) {
  if (!loadedEngine || primed) {
    return;
  }

  if (primePromise) {
    return primePromise;
  }

  primePromise = withTimeout(
    loadedEngine.chatCompletion({
      model: status.modelId || PRIMARY_MODEL_ID,
      messages: [
        { role: "system", content: "You are Memact." },
        { role: "user", content: "Say ready." },
      ],
      stream: false,
      max_tokens: 12,
      temperature: 0,
      top_p: 1,
    }),
    WARMUP_TIMEOUT_MS,
    "warmup_generation_timeout"
  )
    .then(() => {
      primed = true;
    })
    .catch(() => {
      // Ignore warmup failures and let the real request try directly.
    })
    .finally(() => {
      primePromise = null;
    });

  return primePromise;
}

async function ensureEngineLoaded() {
  if (engine) {
    return engine;
  }

  if (loadPromise) {
    return loadPromise;
  }

  if (!hasWebGPU()) {
    updateStatus({
      loading: false,
      ready: false,
      progress: 0,
      text: "Memact needs WebGPU on this device.",
      error: "WebGPU is unavailable on this device.",
      fallbackMode: false,
      templateReason: "",
    });
    throw new Error("webgpu_unavailable");
  }

  loadPromise = createAppConfig()
    .then((appConfig) => tryLoadModel(PRIMARY_MODEL_ID, appConfig))
    .catch((error) => {
      updateStatus({
        loading: false,
        ready: false,
        progress: 0,
        text: "Memact could not load the on-device model.",
        error: String(error?.message || error || "model load failed"),
        fallbackMode: false,
        templateReason: "",
      });
      throw error;
    })
    .finally(() => {
      loadPromise = null;
    });

  return loadPromise;
}

export function subscribeToBrainStatus(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }

  subscribers.add(listener);
  listener(getBrainStatus());
  return () => {
    subscribers.delete(listener);
  };
}

export function getBrainStatus() {
  return { ...status };
}

export function isReady() {
  return Boolean(status.ready && engine);
}

export async function warmBrain() {
  try {
    const loadedEngine = await ensureEngineLoaded();
    if (!primed) {
      updateStatus({
        loading: true,
        ready: true,
        progress: 1,
        text: "Memact is preparing its first reply...",
      });
      await primeEngine(loadedEngine);
      updateStatus({
        loading: false,
        ready: true,
        progress: 1,
        text: "Memact is ready.",
      });
    }
  } catch {
    return getBrainStatus();
  }
  return getBrainStatus();
}

export async function generate({
  systemPrompt,
  userPrompt,
  onToken,
}) {
  const loadedEngine = await ensureEngineLoaded();
  if (!primed) {
    await primeEngine(loadedEngine);
  }
  const stream = await withTimeout(
    loadedEngine.chatCompletion({
      model: status.modelId || PRIMARY_MODEL_ID,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: true,
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0.35,
      top_p: 0.92,
    }),
    GENERATION_START_TIMEOUT_MS,
    "generation_start_timeout"
  );

  let text = "";
  const iterator = stream?.[Symbol.asyncIterator]?.();
  if (!iterator) {
    throw new Error("generation_stream_unavailable");
  }

  while (true) {
    const chunkResult = await withTimeout(
      iterator.next(),
      GENERATION_IDLE_TIMEOUT_MS,
      "generation_stream_timeout"
    );
    if (chunkResult?.done) {
      break;
    }
    const chunk = chunkResult?.value;
    const delta = chunk?.choices?.[0]?.delta?.content;
    const nextToken = Array.isArray(delta)
      ? delta.map((item) => String(item?.text || "")).join("")
      : String(delta || "");
    if (!nextToken) {
      continue;
    }
    text += nextToken;
    await onToken?.(nextToken);
  }

  return {
    text: String(text || "").trim(),
    modelId: status.modelId || PRIMARY_MODEL_ID,
    fallbackMode: false,
  };
}

export function interruptGeneration() {
  try {
    if (engine?.interruptGenerate) {
      engine.interruptGenerate();
    }
  } catch {
    // Ignore interruption failures so the UI can still stop locally.
  }
}
