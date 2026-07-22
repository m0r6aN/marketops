import "@/lib/persuasion-review/db";

import { randomUUID } from "node:crypto";
import { db } from "@/lib/persuasion-review/db";
import type {
  PersuasionApplyRun,
  PersuasionReviewEvent,
  PersuasionReviewRecord,
} from "@/lib/persuasion-review/types";

type ReviewRow = {
  id: string;
  initiative_slug: string;
  content_item_id: string;
  content_version_id: string;
  content_version_number: number;
  content_status: PersuasionReviewRecord["contentStatus"];
  source_updated_at: string;
  title: string;
  channel: string;
  format: string;
  objective: string;
  audience: string;
  offer: string;
  cta: string;
  campaign_id: string;
  body: string;
  suggested_body: string;
  source_materials_json: string;
  authorship: PersuasionReviewRecord["authorship"];
  brand_voice_guideline_id: string;
  brand_voice_snapshot: string;
  claim_findings_json: string;
  summary: string;
  assessments_json: string;
  issue_flags_json: string;
  created_at: string;
};

type ApplyRunRow = {
  id: string;
  persuasion_review_id: string;
  source_content_version_id: string;
  target_content_version_id: string | null;
  status: PersuasionApplyRun["status"];
  summary: string;
  error_message: string;
  created_at: string;
  completed_at: string;
};

type EventRow = {
  id: string;
  persuasion_review_id: string;
  initiative_slug: string;
  content_version_id: string;
  event_type: string;
  summary: string;
  detail_json: string;
  recorded_at: string;
};

function parseArray<T>(value: string): T[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function parseObject(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function mapReview(row: ReviewRow): PersuasionReviewRecord {
  return {
    id: row.id,
    initiativeSlug: row.initiative_slug,
    contentItemId: row.content_item_id,
    contentVersionId: row.content_version_id,
    contentVersionNumber: row.content_version_number,
    contentStatus: row.content_status,
    sourceUpdatedAt: row.source_updated_at,
    title: row.title,
    channel: row.channel,
    format: row.format,
    objective: row.objective,
    audience: row.audience,
    offer: row.offer,
    cta: row.cta,
    campaignId: row.campaign_id,
    body: row.body,
    suggestedBody: row.suggested_body,
    sourceMaterials: parseArray(row.source_materials_json),
    authorship: row.authorship,
    brandVoiceGuidelineId: row.brand_voice_guideline_id,
    brandVoiceSnapshot: row.brand_voice_snapshot,
    claimFindings: parseArray(row.claim_findings_json),
    summary: row.summary,
    assessments: parseArray(row.assessments_json),
    issueFlags: parseArray(row.issue_flags_json),
    createdAt: row.created_at,
  };
}

function mapApplyRun(row: ApplyRunRow): PersuasionApplyRun {
  return {
    id: row.id,
    persuasionReviewId: row.persuasion_review_id,
    sourceContentVersionId: row.source_content_version_id,
    targetContentVersionId: row.target_content_version_id ?? undefined,
    status: row.status,
    summary: row.summary,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function recordEvent(input: {
  persuasionReviewId: string;
  initiativeSlug: string;
  contentVersionId: string;
  eventType: string;
  summary: string;
  detail?: Record<string, unknown>;
  recordedAt: string;
}) {
  db.prepare(
    `INSERT INTO persuasion_review_events
      (id, persuasion_review_id, initiative_slug, content_version_id, event_type, summary, detail_json, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    input.persuasionReviewId,
    input.initiativeSlug,
    input.contentVersionId,
    input.eventType,
    input.summary,
    JSON.stringify(input.detail ?? {}),
    input.recordedAt
  );
}

export function createPersuasionReview(
  input: Omit<PersuasionReviewRecord, "id" | "createdAt">
): PersuasionReviewRecord {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.transaction(() => {
    db.prepare(`
      INSERT INTO persuasion_reviews (
        id, initiative_slug, content_item_id, content_version_id, content_version_number,
        content_status, source_updated_at, title, channel, format, objective, audience,
        offer, cta, campaign_id, body, suggested_body, source_materials_json, authorship,
        brand_voice_guideline_id, brand_voice_snapshot, claim_findings_json, summary,
        assessments_json, issue_flags_json, created_at
      ) VALUES (
        @id, @initiative_slug, @content_item_id, @content_version_id, @content_version_number,
        @content_status, @source_updated_at, @title, @channel, @format, @objective, @audience,
        @offer, @cta, @campaign_id, @body, @suggested_body, @source_materials_json, @authorship,
        @brand_voice_guideline_id, @brand_voice_snapshot, @claim_findings_json, @summary,
        @assessments_json, @issue_flags_json, @created_at
      )
    `).run({
      id,
      initiative_slug: input.initiativeSlug,
      content_item_id: input.contentItemId,
      content_version_id: input.contentVersionId,
      content_version_number: input.contentVersionNumber,
      content_status: input.contentStatus,
      source_updated_at: input.sourceUpdatedAt,
      title: input.title,
      channel: input.channel,
      format: input.format,
      objective: input.objective,
      audience: input.audience,
      offer: input.offer,
      cta: input.cta,
      campaign_id: input.campaignId,
      body: input.body,
      suggested_body: input.suggestedBody,
      source_materials_json: JSON.stringify(input.sourceMaterials),
      authorship: input.authorship,
      brand_voice_guideline_id: input.brandVoiceGuidelineId,
      brand_voice_snapshot: input.brandVoiceSnapshot,
      claim_findings_json: JSON.stringify(input.claimFindings),
      summary: input.summary,
      assessments_json: JSON.stringify(input.assessments),
      issue_flags_json: JSON.stringify(input.issueFlags),
      created_at: now,
    });
    recordEvent({
      persuasionReviewId: id,
      initiativeSlug: input.initiativeSlug,
      contentVersionId: input.contentVersionId,
      eventType: "persuasion.review-created",
      summary: `MarketOps reviewed content version ${input.contentVersionNumber} without changing it.`,
      detail: {
        blockedIssues: input.issueFlags.filter((flag) => flag.status === "blocked").length,
        assessmentCount: input.assessments.length,
      },
      recordedAt: now,
    });
  })();
  return getPersuasionReview(id)!;
}

export function getPersuasionReview(id: string) {
  const row = db.prepare(`SELECT * FROM persuasion_reviews WHERE id = ?`).get(id) as ReviewRow | undefined;
  return row ? mapReview(row) : undefined;
}

export function listPersuasionReviews(initiativeSlug: string) {
  return (db.prepare(
    `SELECT * FROM persuasion_reviews WHERE initiative_slug = ? ORDER BY created_at DESC, id DESC`
  ).all(initiativeSlug) as ReviewRow[]).map(mapReview);
}

export function listPersuasionReviewsForVersion(contentVersionId: string) {
  return (db.prepare(
    `SELECT * FROM persuasion_reviews WHERE content_version_id = ? ORDER BY created_at DESC, id DESC`
  ).all(contentVersionId) as ReviewRow[]).map(mapReview);
}

export function recordPersuasionApplyRun(input: {
  persuasionReviewId: string;
  sourceContentVersionId: string;
  targetContentVersionId?: string;
  status: "succeeded" | "failed";
  summary: string;
  errorMessage?: string;
}) {
  const review = getPersuasionReview(input.persuasionReviewId);
  if (!review) throw new Error("Persuasion review not found.");
  const id = randomUUID();
  const now = new Date().toISOString();
  db.transaction(() => {
    db.prepare(`
      INSERT INTO persuasion_apply_runs (
        id, persuasion_review_id, source_content_version_id, target_content_version_id,
        status, summary, error_message, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.persuasionReviewId,
      input.sourceContentVersionId,
      input.targetContentVersionId ?? null,
      input.status,
      input.summary,
      input.errorMessage ?? "",
      now,
      now
    );
    recordEvent({
      persuasionReviewId: input.persuasionReviewId,
      initiativeSlug: review.initiativeSlug,
      contentVersionId: input.sourceContentVersionId,
      eventType: input.status === "succeeded" ? "persuasion.revision-created" : "persuasion.revision-blocked",
      summary: input.summary,
      detail: { status: input.status, targetContentVersionId: input.targetContentVersionId ?? null },
      recordedAt: now,
    });
  })();
  return listPersuasionApplyRuns(input.persuasionReviewId).find((run) => run.id === id)!;
}

export function listPersuasionApplyRuns(persuasionReviewId: string) {
  return (db.prepare(
    `SELECT * FROM persuasion_apply_runs WHERE persuasion_review_id = ? ORDER BY created_at DESC, id DESC`
  ).all(persuasionReviewId) as ApplyRunRow[]).map(mapApplyRun);
}

export function listPersuasionReviewEvents(persuasionReviewId: string): PersuasionReviewEvent[] {
  return (db.prepare(
    `SELECT * FROM persuasion_review_events WHERE persuasion_review_id = ? ORDER BY recorded_at DESC, id DESC`
  ).all(persuasionReviewId) as EventRow[]).map((row) => ({
    id: row.id,
    persuasionReviewId: row.persuasion_review_id,
    initiativeSlug: row.initiative_slug,
    contentVersionId: row.content_version_id,
    eventType: row.event_type,
    summary: row.summary,
    detail: parseObject(row.detail_json),
    recordedAt: row.recorded_at,
  }));
}

export function purgePersuasionReviewData(initiativeSlug?: string) {
  const reviews = initiativeSlug
    ? (db.prepare(`SELECT id FROM persuasion_reviews WHERE initiative_slug = ?`).all(initiativeSlug) as Array<{ id: string }> )
    : (db.prepare(`SELECT id FROM persuasion_reviews`).all() as Array<{ id: string }>);
  for (const review of reviews) {
    db.prepare(`DELETE FROM persuasion_apply_runs WHERE persuasion_review_id = ?`).run(review.id);
    db.prepare(`DELETE FROM persuasion_review_events WHERE persuasion_review_id = ?`).run(review.id);
    db.prepare(`DELETE FROM persuasion_reviews WHERE id = ?`).run(review.id);
  }
}
