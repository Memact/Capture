import crypto from "node:crypto";
import { extractKeyphrases, normalizeText, slug, splitSentences, uniqueLines } from "./text.mjs";

const RELATION_PATTERNS = [
  { type: "shapes", pattern: /\b(.{3,70}?)\s+(shapes?|shaped|influences?|influenced)\s+(.{3,70})\b/i },
  { type: "claims_causes", pattern: /\b(.{3,70}?)\s+(causes?|caused|creates?|created)\s+(.{3,70})\b/i },
  { type: "leads_to", pattern: /\b(.{3,70}?)\s+(leads?\s+to|led\s+to|pushes?\s+toward)\s+(.{3,70})\b/i },
  { type: "changes", pattern: /\b(.{3,70}?)\s+(changes?|changed|updates?|updated)\s+(.{3,70})\b/i },
  { type: "supports", pattern: /\b(.{3,70}?)\s+(supports?|supported|backs?|backed)\s+(.{3,70})\b/i },
  { type: "contrasts_with", pattern: /\b(.{3,70}?)\s+(contrasts?\s+with|opposes?|conflicts?\s+with)\s+(.{3,70})\b/i },
];

const UI_NOISE_LABELS = new Set([
  "back",
  "close",
  "maximize",
  "menu",
  "minimize",
  "restore",
  "system",
]);

const SENSITIVE_ACTIVITY_PATTERNS = [
  /\b(bank|netbanking|paypal|stripe|razorpay|payment|checkout|billing)\b/i,
  /\b(password|login|signin|otp|one[-\s]?time password|security code)\b/i,
  /\b(inbox|direct message|private message|compose mail|whatsapp|telegram)\b/i,
  /\b(medical|patient portal|lab result|prescription|hospital)\b/i,
];

function hash(value, length = 12) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, length);
}

function classifyNode(label) {
  const text = normalizeText(label).toLowerCase();
  if (/(feel|feeling|fear|stress|hope|pressure|anxiety|confidence|sad|angry|happy|worried)/.test(text)) {
    return "emotion";
  }
  if (/(read|watch|search|build|write|ship|apply|study|learn|decide|choose)/.test(text)) {
    return "action";
  }
  if (/(chrome|edge|github|youtube|spotify|discord|slack|notion|excel|word|powerpoint|terminal|code)/.test(text)) {
    return "tool";
  }
  return "concept";
}

function cleanPhrase(value) {
  return normalizeText(value, 80)
    .replace(/^[,;:.\-\s]+|[,;:.\-\s]+$/g, "")
    .replace(/^(the|a|an|this|that|these|those)\s+/i, "");
}

function addNode(nodes, label, source = "device_text") {
  const clean = cleanPhrase(label);
  if (!clean || clean.length < 3) {
    return null;
  }
  const id = slug(clean, "concept");
  if (!nodes.has(id)) {
    nodes.set(id, {
      id,
      label: clean,
      type: classifyNode(clean),
      source,
      count: 0,
    });
  }
  const node = nodes.get(id);
  node.count += 1;
  return node;
}

function extractEdges(contentUnits, nodes) {
  const edges = [];
  const seen = new Set();
  for (const unit of contentUnits) {
    for (const sentence of splitSentences(unit.text, 8)) {
      for (const relation of RELATION_PATTERNS) {
        const match = sentence.match(relation.pattern);
        if (!match) {
          continue;
        }
        const from = addNode(nodes, match[1], "explicit_relation");
        const to = addNode(nodes, match[3], "explicit_relation");
        if (!from || !to || from.id === to.id) {
          continue;
        }
        const key = `${from.id}|${relation.type}|${to.id}|${unit.unit_id}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        edges.push({
          from: from.id,
          to: to.id,
          type: relation.type,
          evidence: sentence,
          unit_id: unit.unit_id,
          confidence: 0.78,
          extraction: "device_text_pattern",
        });
      }
    }
  }
  return edges;
}

function buildContentUnits(capture) {
  const lines = uniqueLines([
    capture.window_title,
    ...(capture.ui_text || []),
    ...(capture.ocr_text ? [capture.ocr_text] : []),
  ]).filter((line) => !UI_NOISE_LABELS.has(line.toLowerCase()));
  const units = [];

  if (capture.window_title) {
    units.push({
      unit_id: "window_title",
      media_type: "device_window",
      unit_type: "active_window_title",
      text: normalizeText(capture.window_title, 500),
      location: "Active window",
      confidence: 0.82,
    });
  }

  for (const [index, line] of lines.slice(0, 24).entries()) {
    if (line === capture.window_title) {
      continue;
    }
    units.push({
      unit_id: `ui_text_${index + 1}`,
      media_type: "device_window",
      unit_type: "accessibility_text",
      text: line,
      location: "Visible app text",
      confidence: 0.7,
    });
  }

  if (capture.ocr_text) {
    units.push({
      unit_id: "screen_ocr_1",
      media_type: "screen",
      unit_type: "screen_ocr_text",
      text: normalizeText(capture.ocr_text, 1200),
      location: "Ephemeral screen OCR",
      confidence: 0.62,
    });
  }

  return units.filter((unit) => unit.text && unit.text.length >= 3).slice(0, 32);
}

export function createDevicePacket(capture, seq) {
  const occurredAt = normalizeText(capture.captured_at) || new Date().toISOString();
  const application = normalizeText(capture.application || capture.process_name || "device", 120);
  const title = normalizeText(capture.window_title || application, 220);
  const contentUnits = buildContentUnits(capture);
  const fullText = uniqueLines(contentUnits.map((unit) => unit.text), 80).join("\n");
  const keyphrases = extractKeyphrases(`${title}\n${fullText}`, 18);
  const signature = hash([
    application,
    title,
    fullText.toLowerCase().slice(0, 1200),
  ].join("\n"));
  const packetId = `dgc_${seq}_${slug(application, "device")}_${signature}`;
  const nodes = new Map();

  addNode(nodes, application, "application");
  for (const phrase of keyphrases.slice(0, 12)) {
    addNode(nodes, phrase, "device_keyphrase");
  }

  const edges = extractEdges(contentUnits, nodes);
  const event = {
    external_id: `device_${seq}_${signature}`,
    occurred_at: occurredAt,
    application,
    window_title: title,
    url: `memact-device://window/${slug(application, "device")}`,
    interaction_type: "device_focus",
    content_text: normalizeText(title || fullText, 280),
    full_text: normalizeText(fullText, 5000),
    keyphrases_json: JSON.stringify(keyphrases),
    searchable_text: normalizeText(`${application} ${title} ${fullText} ${keyphrases.join(" ")}`, 7000),
    embedding_json: "[]",
    context_profile_json: JSON.stringify({
      source: "device_helper",
      platform: capture.platform,
      application,
      title,
      process_id: capture.process_id || null,
      capture_methods: capture.capture_methods || [],
    }),
    selective_memory_json: "",
    capture_packet_json: "",
    capture_quality_json: JSON.stringify({
      method: "device_helper",
      accessibility_text_count: Array.isArray(capture.ui_text) ? capture.ui_text.length : 0,
      has_ocr_text: Boolean(capture.ocr_text),
      confidence: contentUnits.length ? 0.68 : 0.34,
    }),
    source: "device_helper",
  };

  const graph_packet = {
    packet_id: packetId,
    packet_type: "device_graph_capture",
    schema_version: 1,
    source: "device_helper",
    event_id: null,
    external_event_id: event.external_id,
    url: event.url,
    domain: "device",
    title,
    media_type: "device_window",
    captured_at: occurredAt,
    content_units: contentUnits,
    nodes: [...nodes.values()]
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
      .slice(0, 60),
    edges,
    processing_jobs: [],
  };

  return {
    seq,
    signature,
    occurred_at: occurredAt,
    event,
    graph_packet,
  };
}

export function shouldKeepCapture(capture) {
  const title = normalizeText(capture.window_title, 200);
  const app = normalizeText(capture.application || capture.process_name, 80).toLowerCase();
  const text = uniqueLines([title, ...(capture.ui_text || []), capture.ocr_text], 20).join(" ");
  if (SENSITIVE_ACTIVITY_PATTERNS.some((pattern) => pattern.test(`${app} ${title} ${text}`))) {
    return false;
  }
  if (!title && text.length < 12) {
    return false;
  }
  if (/^(search|start|program manager)$/i.test(title)) {
    return false;
  }
  if (/^(explorer|shellexperiencehost)$/i.test(app) && text.length < 24) {
    return false;
  }
  return true;
}
