import { cosineSimilarity, getRecentEvents } from "./db.js";
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

export async function getCaptureSnapshot(options = {}) {
  const limit = Math.max(1, Number(options.limit || 3000));
  const snapshot = createCaptureActivitySnapshot(await getRecentEvents(limit), {
    cosineSimilarity,
  });
  return {
    system: "capture",
    snapshot_type: "capture-memory-export",
    schema_version: 1,
    generated_at: new Date().toISOString(),
    counts: {
      events: snapshot.events.length,
      sessions: snapshot.sessions.length,
      activities: snapshot.activities.length,
    },
    ...snapshot,
  };
}
