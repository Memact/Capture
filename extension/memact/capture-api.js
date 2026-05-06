import {
  cosineSimilarity,
  getPendingMediaJobs,
  getRecentContentUnits,
  getRecentEvents,
  getRecentGraphPackets,
} from "./db.js";
import { createCaptureActivitySnapshot } from "./activity-model.js";

export async function getEvents(options = {}) {
  const limit = Math.max(1, Number(options.limit || 3000));
  const snapshot = createCaptureActivitySnapshot(await getRecentEvents(limit), {
    cosineSimilarity,
  });
  return snapshot.events;
}

export async function getSessions(options = {}) {
  const limit = Math.max(1, Number(options.limit || 3000));
  const snapshot = createCaptureActivitySnapshot(await getRecentEvents(limit), {
    cosineSimilarity,
  });
  return snapshot.sessions;
}

export async function getActivities(options = {}) {
  const limit = Math.max(1, Number(options.limit || 3000));
  const snapshot = createCaptureActivitySnapshot(await getRecentEvents(limit), {
    cosineSimilarity,
  });
  return snapshot.activities;
}

export async function getContentUnits(options = {}) {
  const limit = Math.max(1, Number(options.limit || 1200));
  if (Array.isArray(options.scopes) && !options.scopes.includes("memory:read_evidence") && !options.scopes.includes("memory:read_graph")) {
    return [];
  }
  return getRecentContentUnits(limit);
}

export async function getGraphPackets(options = {}) {
  const limit = Math.max(1, Number(options.limit || 400));
  const packets = await getRecentGraphPackets(limit);
  if (Array.isArray(options.scopes) && !options.scopes.includes("memory:read_graph")) {
    return packets.map(redactGraphPacket);
  }
  return packets;
}

export async function getMediaJobs(options = {}) {
  const limit = Math.max(1, Number(options.limit || 200));
  if (Array.isArray(options.scopes) && !options.scopes.includes("capture:media")) {
    return [];
  }
  return getPendingMediaJobs(limit);
}

export async function getCaptureSnapshot(options = {}) {
  const limit = Math.max(1, Number(options.limit || 3000));
  const [events, contentUnits, graphPackets, mediaJobs] = await Promise.all([
    getRecentEvents(limit),
    getRecentContentUnits(Math.max(1200, limit)),
    getRecentGraphPackets(Math.max(400, Math.ceil(limit / 2))),
    getPendingMediaJobs(200),
  ]);
  const snapshot = createCaptureActivitySnapshot(events, {
    cosineSimilarity,
  });
  const snapshotResult = {
    system: "capture",
    snapshot_type: "capture-memory-export",
    schema_version: 2,
    generated_at: new Date().toISOString(),
    counts: {
      events: snapshot.events.length,
      sessions: snapshot.sessions.length,
      activities: snapshot.activities.length,
      content_units: contentUnits.length,
      graph_packets: graphPackets.length,
      pending_media_jobs: mediaJobs.length,
    },
    content_units: contentUnits,
    graph_packets: graphPackets,
    pending_media_jobs: mediaJobs,
    ...snapshot,
  };
  return filterCaptureSnapshotForScopes(snapshotResult, options);
}

export function filterCaptureSnapshotForScopes(snapshot, options = {}) {
  const scopes = Array.isArray(options.scopes) ? options.scopes : null;
  const trusted = options.trusted === true || options.accessContext?.trusted === true;
  if (trusted || !scopes) {
    return snapshot;
  }

  const scopeSet = new Set(scopes.map(String));
  const canReadEvidence = scopeSet.has("memory:read_evidence") || scopeSet.has("memory:read_graph");
  const canReadGraph = scopeSet.has("memory:read_graph");

  const filtered = {
    ...snapshot,
    events: canReadEvidence ? snapshot.events : (snapshot.events || []).map(redactEvent),
    sessions: canReadEvidence ? snapshot.sessions : (snapshot.sessions || []).map(redactSession),
    activities: canReadEvidence ? snapshot.activities : (snapshot.activities || []).map(redactActivity),
    content_units: canReadEvidence ? snapshot.content_units : [],
    graph_packets: canReadGraph ? snapshot.graph_packets : (snapshot.graph_packets || []).map(redactGraphPacket),
    pending_media_jobs: [],
    access_filter: {
      scopes: [...scopeSet],
      evidence_visible: canReadEvidence,
      graph_visible: canReadGraph,
      note: "Capture formed local evidence; this response only exposes data allowed by app consent scopes.",
    },
  };

  filtered.counts = {
    ...(snapshot.counts || {}),
    content_units: filtered.content_units.length,
    graph_packets: filtered.graph_packets.length,
    pending_media_jobs: 0,
  };
  return filtered;
}

function redactEvent(event = {}) {
  return {
    id: event.id,
    occurred_at: event.occurred_at,
    domain: event.domain,
    application: event.application,
    interaction_type: event.interaction_type,
    page_type: event.page_type,
    retained: Boolean(event.retained ?? true),
  };
}

function redactSession(session = {}) {
  return {
    id: session.id,
    started_at: session.started_at,
    ended_at: session.ended_at,
    duration_ms: session.duration_ms,
    event_count: session.event_count,
    domains: session.domains,
    applications: session.applications,
  };
}

function redactActivity(activity = {}) {
  return {
    id: activity.id,
    key: activity.key,
    started_at: activity.started_at,
    ended_at: activity.ended_at,
    duration_ms: activity.duration_ms,
    event_count: activity.event_count,
    domains: activity.domains,
    applications: activity.applications,
    mode: activity.mode,
  };
}

function redactGraphPacket(packet = {}) {
  return {
    packet_id: packet.packet_id,
    packet_type: packet.packet_type,
    schema_version: packet.schema_version,
    source: packet.source,
    domain: packet.domain,
    media_type: packet.media_type,
    captured_at: packet.captured_at,
    content_unit_count: Array.isArray(packet.content_units) ? packet.content_units.length : 0,
    node_count: Array.isArray(packet.nodes) ? packet.nodes.length : 0,
    edge_count: Array.isArray(packet.edges) ? packet.edges.length : 0,
    evidence_link_count: Array.isArray(packet.evidence_links) ? packet.evidence_links.length : 0,
    schema_packet_count: Array.isArray(packet.schema_packets) ? packet.schema_packets.length : 0,
    nodes: [],
    edges: [],
    evidence_links: [],
    schema_packets: [],
    knowledge_graph: null,
    schema_memory: null,
    content_units: [],
    redacted: true,
  };
}
