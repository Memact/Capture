import assert from "node:assert/strict";
import test from "node:test";
import { buildMultimediaGraphPacket } from "../extension/memact/multimedia-graph.js";
import { classifyCapturePrivacy } from "../extension/memact/privacy-boundary.js";

test("multimedia graph packets include evidence-backed schema memory", () => {
  const packet = buildMultimediaGraphPacket({
    tabData: {
      activeTab: {
        url: "https://example.com/startup",
        title: "Startup focus",
      },
    },
    activeContext: {
      contentUnits: [
        {
          unit_id: "p1",
          unit_type: "paragraph",
          text: "Repeated startup videos shaped my attention toward building a project.",
          confidence: 0.88,
        },
      ],
    },
    profile: {
      url: "https://example.com/startup",
      title: "Startup focus",
      pageType: "article",
      subject: "startup building",
      topics: ["startup", "project"],
    },
    capturePacket: {
      searchTerms: ["startup", "project"],
      blocks: [],
    },
    eventId: 42,
  });

  assert.equal(packet.packet_type, "multimedia_graph_capture");
  assert.ok(packet.evidence_links.length >= 1);
  assert.ok(packet.knowledge_graph.nodes.length >= 1);
  assert.ok(packet.schema_packets.length >= 1);
  assert.equal(packet.schema_memory.authority, "local_evidence_graph");
  assert.ok(packet.schema_packets[0].node_ids.length >= 1);
  assert.ok(packet.schema_packets[0].evidence_ids.length >= 1);
});

test("privacy boundary blocks sensitive pages before graph formation", () => {
  const privacy = classifyCapturePrivacy({
    url: "https://bank.example.com/account/login",
    title: "Bank login",
    fullText: "Enter one time password and card number",
  });

  assert.equal(privacy.action, "block");
  assert.equal(privacy.allowGraph, false);
});
