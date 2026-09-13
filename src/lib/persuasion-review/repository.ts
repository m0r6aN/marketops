import { requireTenantMatch } from "@/lib/auth/session";
import "@/lib/persuasion-review/db";

// ── w2-tenant-wire: row-tenant predicate (forward-compatible) ───────────────
// SQLite rows predate tenant_id (see db/migrations/002 for the PG schema); PG
// rows carry tenant_id NOT NULL. getRowTenantId returns the row tenant when the
// record carries one (tenantId / tenant_id / tenant), else null for legacy
// local-default sqlite rows. requireRowTenantMatch enforces session == row via
// requireTenantMatch when a tenant is present; legacy rows without a tenant
// column are treated as session-owned (single-tenant local sqlite) — beta PG
// isolation is enforced by RLS (003/005) plus the per-tenant UNIQUEs (004).
// Local-default rows stay valid; 'local-default' must never appear in beta.
export function getRowTenantId(row: unknown): string | null {
  if (typeof row !== "object" || row === null) return null;
  const record = row as Record<string, unknown>;
  const value = record.tenantId ?? record.tenant_id ?? record.tenant ?? null;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function requireRowTenantMatch(
  sessionTenantId: string,
  row: unknown,
  action: string,
): string {
  const rowTenantId = getRowTenantId(row);
  if (rowTenantId === null) return sessionTenantId;
  return requireTenantMatch(sessionTenantId, rowTenantId, action);
}

export function isRowVisibleToTenant(sessionTenantId: string, row: unknown): boolean {
  const rowTenantId = getRowTenantId(row);
  if (rowTenantId === null) return true;
  return rowTenantId === sessionTenantId;
}

import { randomUUID } from "node:crypto";
import { db } from "@/lib/persuasion-review/db";
import { CLAIM_POLICY_VERSION } from "@/lib/claims/policy";
import { buildClaimDecisionSummary } from "@/lib/persuasion-review/service";
import type {
  ClaimDecisionVerdict,
  PersuasionApplyRun,
  PersuasionReviewEvent,
  PersuasionReviewRecord,
} from "@/lib/persuasion-review/types";
import type { ApprovalState, Receipt } from "@/lib/marketops/entities";

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
    // w2-claim-approval-wire: claim-gate rows are owned by the review.
    db.prepare(`DELETE FROM claim_decision_receipts WHERE persuasion_review_id = ?`).run(review.id);
    db.prepare(`DELETE FROM claim_approvals WHERE persuasion_review_id = ?`).run(review.id);
    db.prepare(`DELETE FROM persuasion_reviews WHERE id = ?`).run(review.id);
  }
}

// ── w2-claim-approval-wire: claim decision receipts + operator approvals ─────
// Subject mapping (explicit, see PR open decisions): persuasion reviews and
// content versions are not canonical Receipt/ApprovalState subject types, so
// rows carry native persuasion_review_id + content_version_id columns and map
// to the canonical entities with subjectEntityType "ContentAsset" (the
// nearest canonical holder of content versions). The review id, content
// version id, policy version, evidence refs, and rationale are always embedded
// in the summary/notes so receipts stay readable without resolving the
// mapping. Additive tables only — no existing schema touched.

type ClaimReceiptRow = {
  id: string;
  persuasion_review_id: string;
  content_version_id: string;
  initiative_slug: string;
  verdict: string;
  policy_version: string;
  summary: string;
  evidence_refs_json: string;
  rationale: string;
  created_at: string;
};

type ClaimApprovalRow = {
  id: string;
  persuasion_review_id: string;
  content_version_id: string;
  initiative_slug: string;
  decision: string;
  requested_by: string;
  requested_by_display: string;
  reviewed_by: string;
  reviewed_by_display: string;
  notes: string;
  decided_at: string;
  created_at: string;
};

function claimEvidenceList(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

function mapClaimReceipt(row: ClaimReceiptRow): Receipt {
  return {
    id: row.id,
    slug: `claim-decision-${row.id.slice(0, 8)}`,
    name: `Claim ${row.verdict} for review ${row.persuasion_review_id.slice(0, 8)}`,
    kind: row.verdict === "approved-apply" ? "approval" : "verification",
    subjectEntityId: row.content_version_id,
    subjectEntityType: "ContentAsset",
    summary: row.summary,
    verificationState: "recorded",
    createdAt: row.created_at,
    updatedAt: row.created_at,
  };
}

function mapClaimApproval(row: ClaimApprovalRow): ApprovalState {
  return {
    id: row.id,
    slug: `claim-approval-${row.id.slice(0, 8)}`,
    name: `Claim approval for review ${row.persuasion_review_id.slice(0, 8)}`,
    subjectEntityId: row.persuasion_review_id,
    subjectEntityType: "ContentAsset",
    requestedById: row.requested_by,
    requestedByDisplayName: row.requested_by_display || undefined,
    notes: row.notes || undefined,
    decision: "approved",
    reviewedById: row.reviewed_by,
    reviewedByDisplayName: row.reviewed_by_display || undefined,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
    updatedAt: row.created_at,
  };
}

/**
 * Persist a strict-gate decision receipt. The summary always embeds the
 * policy version, evidence refs, and rationale (built centrally so the ruling
 * cannot drift per call site).
 */
export function recordClaimDecisionReceipt(input: {
  reviewId: string;
  contentVersionId: string;
  initiativeSlug: string;
  verdict: ClaimDecisionVerdict;
  rationale: string;
  evidenceRefs: string[];
}): Receipt {
  const id = randomUUID();
  const now = new Date().toISOString();
  const evidenceRefs = (input.evidenceRefs ?? []).filter(
    (entry) => typeof entry === "string" && entry.trim().length > 0,
  );
  const summary = buildClaimDecisionSummary({
    verdict: input.verdict,
    rationale: `${input.rationale} (review ${input.reviewId}, content version ${input.contentVersionId})`,
    evidenceRefs,
  });
  db.prepare(
    `INSERT INTO claim_decision_receipts
      (id, persuasion_review_id, content_version_id, initiative_slug, verdict,
       policy_version, summary, evidence_refs_json, rationale, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.reviewId,
    input.contentVersionId,
    input.initiativeSlug,
    input.verdict,
    CLAIM_POLICY_VERSION,
    summary,
    JSON.stringify(evidenceRefs),
    input.rationale,
    now,
  );
  return getClaimDecisionReceipt(id)!;
}

export function getClaimDecisionReceipt(id: string) {
  const row = db
    .prepare(`SELECT * FROM claim_decision_receipts WHERE id = ?`)
    .get(id) as ClaimReceiptRow | undefined;
  return row ? mapClaimReceipt(row) : undefined;
}

/** Every decision receipt for a review, newest first (readable trail). */
export function listClaimDecisionReceipts(reviewId: string): Receipt[] {
  return (
    db
      .prepare(
        `SELECT * FROM claim_decision_receipts WHERE persuasion_review_id = ? ORDER BY created_at DESC, id DESC`,
      )
      .all(reviewId) as ClaimReceiptRow[]
  ).map(mapClaimReceipt);
}

export function getLatestClaimDecisionReceipt(reviewId: string) {
  return listClaimDecisionReceipts(reviewId)[0];
}

/** Raw evidence refs behind a review's decision receipts (for the UX). */
export function listClaimDecisionEvidenceRefs(reviewId: string): string[] {
  const rows = db
    .prepare(
      `SELECT evidence_refs_json FROM claim_decision_receipts WHERE persuasion_review_id = ? ORDER BY created_at DESC, id DESC`,
    )
    .all(reviewId) as Array<{ evidence_refs_json: string }>;
  const seen = new Set<string>();
  for (const row of rows) {
    for (const ref of claimEvidenceList(row.evidence_refs_json)) {
      if (!seen.has(ref)) seen.add(ref);
    }
  }
  return [...seen];
}

/**
 * Record an operator approval for a needs-review item. Reuses the canonical
 * ApprovalState shape (decision "approved", subject = the review id). Blocked
 * verdicts must never reach this function — the service gate and the server
 * action refuse them first.
 */
export function recordClaimApproval(input: {
  reviewId: string;
  contentVersionId: string;
  initiativeSlug: string;
  requestedBy: string;
  requestedByDisplayName?: string;
  reviewedBy: string;
  reviewedByDisplayName?: string;
  notes?: string;
}): ApprovalState {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO claim_approvals
      (id, persuasion_review_id, content_version_id, initiative_slug, decision,
       requested_by, requested_by_display, reviewed_by, reviewed_by_display,
       notes, decided_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.reviewId,
    input.contentVersionId,
    input.initiativeSlug,
    "approved",
    input.requestedBy,
    input.requestedByDisplayName ?? "",
    input.reviewedBy,
    input.reviewedByDisplayName ?? "",
    input.notes ?? "",
    now,
    now,
  );
  return getClaimApproval(id)!;
}

export function getClaimApproval(id: string) {
  const row = db
    .prepare(`SELECT * FROM claim_approvals WHERE id = ?`)
    .get(id) as ClaimApprovalRow | undefined;
  return row ? mapClaimApproval(row) : undefined;
}

/** Latest recorded approval for a review, if any. */
export function getLatestClaimApprovalForReview(
  reviewId: string,
): ApprovalState | undefined {
  const row = db
    .prepare(
      `SELECT * FROM claim_approvals WHERE persuasion_review_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`,
    )
    .get(reviewId) as ClaimApprovalRow | undefined;
  return row ? mapClaimApproval(row) : undefined;
}

/** True only when an approved ApprovalState is recorded for the review id. */
export function hasApprovedClaimApproval(reviewId: string): boolean {
  const approval = getLatestClaimApprovalForReview(reviewId);
  return approval?.decision === "approved";
}
