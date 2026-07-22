import "@/lib/content-workspace/db";

import { randomUUID } from "node:crypto";
import { db } from "@/lib/content-workspace/db";
import { assertContentStatusTransition } from "@/lib/content-workspace/service";
import type {
  ContentEvent,
  ContentGenerationRun,
  ContentGenerationStatus,
  ContentVersionInput,
  ContentVersionRecord,
} from "@/lib/content-workspace/types";

type VersionRow = {
  id: string; content_item_id: string; initiative_slug: string; version_number: number;
  title: string; status: ContentVersionRecord["status"]; channel: string; format: string;
  objective: string; audience: string; offer: string; cta: string; campaign_id: string;
  brand_voice_guideline_id: string; brand_voice_snapshot: string; source_materials_json: string;
  body: string; authorship: ContentVersionRecord["authorship"]; claim_findings_json: string; notes: string;
  created_at: string; updated_at: string; approved_at: string | null;
};
type RunRow = { id: string; content_version_id: string; status: ContentGenerationStatus; provider: string; model: string; request_summary: string; result_text: string; error_message: string; created_at: string; completed_at: string };
type EventRow = { id: string; content_item_id: string; content_version_id: string; initiative_slug: string; event_type: string; summary: string; detail_json: string; recorded_at: string };

function array<T>(value: string): T[] { try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed as T[] : []; } catch { return []; } }
function object(value: string): Record<string, unknown> { try { const parsed: unknown = JSON.parse(value); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}; } catch { return {}; } }

function mapVersion(row: VersionRow): ContentVersionRecord {
  return {
    id: row.id, contentItemId: row.content_item_id, initiativeSlug: row.initiative_slug, versionNumber: row.version_number,
    title: row.title, status: row.status, channel: row.channel, format: row.format, objective: row.objective,
    audience: row.audience, offer: row.offer, cta: row.cta, campaignId: row.campaign_id,
    brandVoiceGuidelineId: row.brand_voice_guideline_id, brandVoiceSnapshot: row.brand_voice_snapshot,
    sourceMaterials: array(row.source_materials_json), body: row.body, authorship: row.authorship,
    claimFindings: array(row.claim_findings_json), notes: row.notes, createdAt: row.created_at,
    updatedAt: row.updated_at, approvedAt: row.approved_at ?? undefined,
  };
}
function mapRun(row: RunRow): ContentGenerationRun { return { id: row.id, contentVersionId: row.content_version_id, status: row.status, provider: row.provider, model: row.model, requestSummary: row.request_summary, resultText: row.result_text, errorMessage: row.error_message, createdAt: row.created_at, completedAt: row.completed_at }; }
function mapEvent(row: EventRow): ContentEvent { return { id: row.id, contentItemId: row.content_item_id, contentVersionId: row.content_version_id, initiativeSlug: row.initiative_slug, eventType: row.event_type, summary: row.summary, detail: object(row.detail_json), recordedAt: row.recorded_at }; }

function params(id: string, itemId: string, slug: string, version: number, input: ContentVersionInput, createdAt: string, updatedAt: string, approvedAt?: string) {
  return { id, content_item_id: itemId, initiative_slug: slug, version_number: version, title: input.title, status: input.status,
    channel: input.channel, format: input.format, objective: input.objective, audience: input.audience, offer: input.offer,
    cta: input.cta, campaign_id: input.campaignId, brand_voice_guideline_id: input.brandVoiceGuidelineId,
    brand_voice_snapshot: input.brandVoiceSnapshot, source_materials_json: JSON.stringify(input.sourceMaterials), body: input.body,
    authorship: input.authorship, claim_findings_json: JSON.stringify(input.claimFindings), notes: input.notes,
    created_at: createdAt, updated_at: updatedAt, approved_at: approvedAt ?? null };
}

function event(itemId: string, versionId: string, slug: string, eventType: string, summary: string, detail: Record<string, unknown>, at: string) {
  db.prepare(`INSERT INTO content_events (id, content_item_id, content_version_id, initiative_slug, event_type, summary, detail_json, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(randomUUID(), itemId, versionId, slug, eventType, summary, JSON.stringify(detail), at);
}

export function listContentVersions(initiativeSlug: string) {
  return (db.prepare(`SELECT * FROM content_versions WHERE initiative_slug = ? ORDER BY updated_at DESC, version_number DESC`).all(initiativeSlug) as VersionRow[]).map(mapVersion);
}
export function getContentVersion(id: string) { const row = db.prepare(`SELECT * FROM content_versions WHERE id = ?`).get(id) as VersionRow | undefined; return row ? mapVersion(row) : undefined; }

export function createContentItem(initiativeSlug: string, input: ContentVersionInput) {
  if (input.status !== "draft") throw new Error("New content must begin as a draft.");
  const now = new Date().toISOString(); const itemId = randomUUID(); const versionId = randomUUID();
  db.transaction(() => {
    db.prepare(`INSERT INTO content_items (id, initiative_slug, created_at, updated_at) VALUES (?, ?, ?, ?)`).run(itemId, initiativeSlug, now, now);
    db.prepare(`INSERT INTO content_versions (id, content_item_id, initiative_slug, version_number, title, status, channel, format, objective, audience, offer, cta, campaign_id, brand_voice_guideline_id, brand_voice_snapshot, source_materials_json, body, authorship, claim_findings_json, notes, created_at, updated_at, approved_at) VALUES (@id,@content_item_id,@initiative_slug,@version_number,@title,@status,@channel,@format,@objective,@audience,@offer,@cta,@campaign_id,@brand_voice_guideline_id,@brand_voice_snapshot,@source_materials_json,@body,@authorship,@claim_findings_json,@notes,@created_at,@updated_at,@approved_at)`)
      .run(params(versionId, itemId, initiativeSlug, 1, input, now, now));
    event(itemId, versionId, initiativeSlug, "content.version-created", "MarketOps created content version 1 as draft.", { versionNumber: 1 }, now);
  })();
  return getContentVersion(versionId)!;
}

export function createContentVersion(baseId: string, input: ContentVersionInput) {
  const base = getContentVersion(baseId); if (!base) throw new Error("Base content version not found.");
  if (input.status !== "draft") throw new Error("New content versions must begin as drafts.");
  const now = new Date().toISOString(); const id = randomUUID(); let versionNumber = 0;
  db.transaction(() => {
    versionNumber = (db.prepare(`SELECT COALESCE(MAX(version_number),0) AS n FROM content_versions WHERE content_item_id = ?`).get(base.contentItemId) as { n: number }).n + 1;
    db.prepare(`INSERT INTO content_versions (id, content_item_id, initiative_slug, version_number, title, status, channel, format, objective, audience, offer, cta, campaign_id, brand_voice_guideline_id, brand_voice_snapshot, source_materials_json, body, authorship, claim_findings_json, notes, created_at, updated_at, approved_at) VALUES (@id,@content_item_id,@initiative_slug,@version_number,@title,@status,@channel,@format,@objective,@audience,@offer,@cta,@campaign_id,@brand_voice_guideline_id,@brand_voice_snapshot,@source_materials_json,@body,@authorship,@claim_findings_json,@notes,@created_at,@updated_at,@approved_at)`)
      .run(params(id, base.contentItemId, base.initiativeSlug, versionNumber, input, now, now));
    event(base.contentItemId, id, base.initiativeSlug, "content.version-created", `MarketOps created content version ${versionNumber} as draft.`, { versionNumber, basedOn: baseId }, now);
  })();
  return getContentVersion(id)!;
}

export function updateContentVersion(id: string, input: ContentVersionInput) {
  const existing = getContentVersion(id); if (!existing) throw new Error("Content version not found.");
  if (["approved", "superseded"].includes(existing.status)) throw new Error("Approved and superseded content versions are immutable. Create a new version.");
  assertContentStatusTransition(existing.status, input.status);
  const now = new Date().toISOString();
  const changed = (Object.keys(input) as Array<keyof ContentVersionInput>).filter((key) => JSON.stringify(existing[key]) !== JSON.stringify(input[key]));
  db.transaction(() => {
    if (input.status === "approved") {
      const prior = db.prepare(`SELECT * FROM content_versions WHERE content_item_id = ? AND status = 'approved' AND id <> ?`).all(existing.contentItemId, id) as VersionRow[];
      db.prepare(`UPDATE content_versions SET status='superseded', updated_at=? WHERE content_item_id=? AND status='approved' AND id<>?`).run(now, existing.contentItemId, id);
      prior.forEach((row) => event(existing.contentItemId, row.id, existing.initiativeSlug, "content.version-superseded", `Content version ${row.version_number} was superseded by version ${existing.versionNumber}.`, { supersededBy: id }, now));
    }
    const p = params(id, existing.contentItemId, existing.initiativeSlug, existing.versionNumber, input, existing.createdAt, now, input.status === "approved" ? now : undefined);
    db.prepare(`UPDATE content_versions SET title=@title,status=@status,channel=@channel,format=@format,objective=@objective,audience=@audience,offer=@offer,cta=@cta,campaign_id=@campaign_id,brand_voice_guideline_id=@brand_voice_guideline_id,brand_voice_snapshot=@brand_voice_snapshot,source_materials_json=@source_materials_json,body=@body,authorship=@authorship,claim_findings_json=@claim_findings_json,notes=@notes,updated_at=@updated_at,approved_at=@approved_at WHERE id=@id`).run(p);
    db.prepare(`UPDATE content_items SET updated_at=? WHERE id=?`).run(now, existing.contentItemId);
    if (changed.length) event(existing.contentItemId, id, existing.initiativeSlug, existing.status === input.status ? "content.version-updated" : "content.status-changed", existing.status === input.status ? `MarketOps updated content version ${existing.versionNumber}.` : `Content version ${existing.versionNumber} moved from ${existing.status} to ${input.status}.`, { changedFields: changed, previousStatus: existing.status, status: input.status }, now);
  })();
  return getContentVersion(id)!;
}

export function recordContentGenerationRun(version: ContentVersionRecord, result: { status: ContentGenerationStatus; provider: string; model: string; requestSummary: string; resultText: string; errorMessage: string }) {
  const id = randomUUID(); const now = new Date().toISOString();
  db.transaction(() => {
    db.prepare(`INSERT INTO content_generation_runs (id, content_version_id, status, provider, model, request_summary, result_text, error_message, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, version.id, result.status, result.provider, result.model, result.requestSummary, result.resultText, result.errorMessage, now, now);
    event(version.contentItemId, version.id, version.initiativeSlug, "content.generation-recorded", `Content generation ${result.status}; no publishing action occurred.`, { runId: id, status: result.status, provider: result.provider, model: result.model }, now);
  })();
  return listContentGenerationRuns(version.id).find((run) => run.id === id)!;
}
export function listContentGenerationRuns(versionId: string) { return (db.prepare(`SELECT * FROM content_generation_runs WHERE content_version_id=? ORDER BY created_at DESC`).all(versionId) as RunRow[]).map(mapRun); }
export function contentItemHasSuccessfulGeneration(contentItemId: string) {
  return Boolean(db.prepare(`SELECT 1 FROM content_generation_runs r JOIN content_versions v ON v.id=r.content_version_id WHERE v.content_item_id=? AND r.status='succeeded' LIMIT 1`).get(contentItemId));
}
export function listContentEvents(versionId: string) { return (db.prepare(`SELECT * FROM content_events WHERE content_version_id=? ORDER BY recorded_at DESC`).all(versionId) as EventRow[]).map(mapEvent); }
export function purgeContentWorkspaceData(initiativeSlug?: string) {
  const versions = initiativeSlug ? db.prepare(`SELECT id,content_item_id FROM content_versions WHERE initiative_slug=?`).all(initiativeSlug) as Array<{id:string;content_item_id:string}> : db.prepare(`SELECT id,content_item_id FROM content_versions`).all() as Array<{id:string;content_item_id:string}>;
  versions.forEach((v) => { db.prepare(`DELETE FROM content_generation_runs WHERE content_version_id=?`).run(v.id); db.prepare(`DELETE FROM content_events WHERE content_version_id=?`).run(v.id); db.prepare(`DELETE FROM content_versions WHERE id=?`).run(v.id); });
  new Set(versions.map((v) => v.content_item_id)).forEach((id) => db.prepare(`DELETE FROM content_items WHERE id=?`).run(id));
}
