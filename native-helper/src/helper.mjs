#!/usr/bin/env node
import http from "node:http";
import { captureActiveWindow, captureScreenOcr } from "./windows-capture.mjs";
import { createDevicePacket, shouldKeepCapture } from "./packets.mjs";
import { normalizeText } from "./text.mjs";

const DEFAULT_PORT = 38489;
const DEFAULT_INTERVAL_MS = 7000;
const MAX_RECORDS = 600;

function parseArgs(argv) {
  const args = {
    port: Number(process.env.MEMACT_CAPTURE_HELPER_PORT || DEFAULT_PORT),
    intervalMs: Number(process.env.MEMACT_CAPTURE_HELPER_INTERVAL_MS || DEFAULT_INTERVAL_MS),
    once: false,
    json: false,
    ocr: process.env.MEMACT_CAPTURE_HELPER_OCR === "1",
    maxElements: Number(process.env.MEMACT_CAPTURE_HELPER_MAX_UI_ELEMENTS || 160),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--once") args.once = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--ocr") args.ocr = true;
    else if (arg === "--no-ocr") args.ocr = false;
    else if (arg === "--port") args.port = Number(argv[++index] || DEFAULT_PORT);
    else if (arg === "--interval-ms") args.intervalMs = Number(argv[++index] || DEFAULT_INTERVAL_MS);
    else if (arg === "--max-elements") args.maxElements = Number(argv[++index] || 160);
  }

  if (!Number.isFinite(args.port) || args.port <= 0) args.port = DEFAULT_PORT;
  if (!Number.isFinite(args.intervalMs) || args.intervalMs < 3000) args.intervalMs = DEFAULT_INTERVAL_MS;
  if (!Number.isFinite(args.maxElements) || args.maxElements < 20) args.maxElements = 160;
  return args;
}

function jsonResponse(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(body, null, 2));
}

class DeviceCaptureHelper {
  constructor(options) {
    this.options = options;
    this.records = [];
    this.seq = 0;
    this.lastSignature = "";
    this.lastCaptureAt = "";
    this.lastError = "";
    this.timer = null;
    this.capturing = false;
  }

  getStatus() {
    return {
      ok: true,
      system: "memact-device-helper",
      schema_version: "memact.device_capture.v0",
      platform: process.platform,
      port: this.options.port,
      interval_ms: this.options.intervalMs,
      ocr_enabled: Boolean(this.options.ocr),
      record_count: this.records.length,
      latest_seq: this.seq,
      last_capture_at: this.lastCaptureAt,
      last_error: this.lastError,
      raw_media_retained: false,
    };
  }

  async captureOnce() {
    if (this.capturing) {
      return null;
    }
    this.capturing = true;
    try {
      const activeWindow = await captureActiveWindow({
        maxElements: this.options.maxElements,
      });
      const ocrText = await captureScreenOcr({
        enabled: this.options.ocr,
      });
      const capture = {
        ...activeWindow,
        platform: activeWindow.platform || process.platform,
        ocr_text: normalizeText(ocrText, 2400),
        capture_methods: [
          ...(Array.isArray(activeWindow.capture_methods) ? activeWindow.capture_methods : []),
          ...(ocrText ? ["ephemeral_screen_ocr"] : []),
        ],
        captured_at: new Date().toISOString(),
      };

      if (!shouldKeepCapture(capture)) {
        this.lastCaptureAt = capture.captured_at;
        this.lastError = "";
        return null;
      }

      const packet = createDevicePacket(capture, this.seq + 1);
      if (packet.signature === this.lastSignature) {
        this.lastCaptureAt = capture.captured_at;
        this.lastError = "";
        return null;
      }

      this.seq = packet.seq;
      this.lastSignature = packet.signature;
      this.lastCaptureAt = packet.occurred_at;
      this.lastError = "";
      this.records.push(packet);
      if (this.records.length > MAX_RECORDS) {
        this.records.splice(0, this.records.length - MAX_RECORDS);
      }
      return packet;
    } catch (error) {
      this.lastError = String(error?.message || error || "capture failed");
      return null;
    } finally {
      this.capturing = false;
    }
  }

  start() {
    if (this.timer) {
      return;
    }
    this.captureOnce().catch(() => {});
    this.timer = setInterval(() => {
      this.captureOnce().catch(() => {});
    }, this.options.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  snapshot({ afterSeq = 0, limit = 80 } = {}) {
    const safeAfterSeq = Number(afterSeq || 0);
    const safeLimit = Math.min(200, Math.max(1, Number(limit || 80)));
    const records = this.records
      .filter((record) => Number(record.seq || 0) > safeAfterSeq)
      .slice(-safeLimit);
    return {
      ...this.getStatus(),
      records,
      events: records.map((record) => record.event),
      graph_packets: records.map((record) => record.graph_packet),
    };
  }
}

function createServer(helper) {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
      if (request.method === "OPTIONS") {
        jsonResponse(response, 200, { ok: true });
        return;
      }
      if (url.pathname === "/" || url.pathname === "/health") {
        jsonResponse(response, 200, helper.getStatus());
        return;
      }
      if (url.pathname === "/capture/once") {
        const record = await helper.captureOnce();
        jsonResponse(response, 200, {
          ...helper.getStatus(),
          record,
        });
        return;
      }
      if (url.pathname === "/capture/snapshot") {
        jsonResponse(response, 200, helper.snapshot({
          afterSeq: url.searchParams.get("after_seq"),
          limit: url.searchParams.get("limit"),
        }));
        return;
      }
      jsonResponse(response, 404, {
        ok: false,
        error: "not_found",
      });
    } catch (error) {
      jsonResponse(response, 500, {
        ok: false,
        error: String(error?.message || error || "helper failed"),
      });
    }
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const helper = new DeviceCaptureHelper(options);

  if (options.once) {
    const record = await helper.captureOnce();
    const output = {
      ...helper.getStatus(),
      record,
      records: record ? [record] : [],
    };
    if (options.json) {
      process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    } else {
      process.stdout.write(`Memact local helper observed ${record ? "one packet" : "no meaningful change"}.\n`);
    }
    return;
  }

  helper.start();
  const server = createServer(helper);
  server.listen(options.port, "127.0.0.1", () => {
    process.stdout.write(`Memact local helper running at http://127.0.0.1:${options.port}\n`);
    process.stdout.write(`Raw screenshots/audio are not retained. OCR is ${options.ocr ? "enabled" : "off"}.\n`);
  });

  const shutdown = () => {
    helper.stop();
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
