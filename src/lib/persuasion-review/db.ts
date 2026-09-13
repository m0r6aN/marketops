// w1-postgres-rls-migrate: db comes from the provider; parent import kept as
// a side effect so table-creation order is unchanged on the sqlite default.
import "@/lib/content-workspace/db";
import { db } from "@/lib/db/provider";

db.exec(`
  CREATE TABLE IF NOT EXISTS persuasion_reviews (
    id TEXT PRIMARY KEY,
    initiative_slug TEXT NOT NULL,
    content_item_id TEXT NOT NULL,
    content_version_id TEXT NOT NULL,
    content_version_number INTEGER NOT NULL,
    content_status TEXT NOT NULL,
    source_updated_at TEXT NOT NULL,
    title TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT '',
    format TEXT NOT NULL DEFAULT '',
    objective TEXT NOT NULL DEFAULT '',
    audience TEXT NOT NULL DEFAULT '',
    offer TEXT NOT NULL DEFAULT '',
    cta TEXT NOT NULL DEFAULT '',
    campaign_id TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    suggested_body TEXT NOT NULL DEFAULT '',
    source_materials_json TEXT NOT NULL DEFAULT '[]',
    authorship TEXT NOT NULL,
    brand_voice_guideline_id TEXT NOT NULL DEFAULT '',
    brand_voice_snapshot TEXT NOT NULL DEFAULT '',
    claim_findings_json TEXT NOT NULL DEFAULT '[]',
    summary TEXT NOT NULL,
    assessments_json TEXT NOT NULL DEFAULT '[]',
    issue_flags_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS persuasion_apply_runs (
    id TEXT PRIMARY KEY,
    persuasion_review_id TEXT NOT NULL,
    source_content_version_id TEXT NOT NULL,
    target_content_version_id TEXT,
    status TEXT NOT NULL,
    summary TEXT NOT NULL,
    error_message TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    completed_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS persuasion_review_events (
    id TEXT PRIMARY KEY,
    persuasion_review_id TEXT NOT NULL,
    initiative_slug TEXT NOT NULL,
    content_version_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    summary TEXT NOT NULL,
    detail_json TEXT NOT NULL DEFAULT '{}',
    recorded_at TEXT NOT NULL
  );

  -- w2-claim-approval-wire (additive only — existing tables untouched):
  -- claim_decision_receipts persists every strict-gate decision (blocked /
  -- needs-review / safe / approved-apply) with the policy version, evidence
  -- refs, and rationale required by the publication-gate ruling. There is no
  -- pre-existing receipt store for persuasion reviews, so this dedicated
  -- table is the grounded home; rows map to the canonical Receipt entity in
  -- repository.ts (subject = the reviewed content version; see the
  -- CONTENT_ASSET_SUBJECT mapping note there).
  CREATE TABLE IF NOT EXISTS claim_decision_receipts (
    id TEXT PRIMARY KEY,
    persuasion_review_id TEXT NOT NULL,
    content_version_id TEXT NOT NULL,
    initiative_slug TEXT NOT NULL,
    verdict TEXT NOT NULL,
    policy_version TEXT NOT NULL,
    summary TEXT NOT NULL,
    evidence_refs_json TEXT NOT NULL DEFAULT '[]',
    rationale TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  -- w2-claim-approval-wire (additive only): operator approvals that authorize
  -- applying a needs-review item. Rows map to the canonical ApprovalState
  -- entity in repository.ts. Blocked verdicts can never be approved (enforced
  -- in service.ts, not by schema).
  CREATE TABLE IF NOT EXISTS claim_approvals (
    id TEXT PRIMARY KEY,
    persuasion_review_id TEXT NOT NULL,
    content_version_id TEXT NOT NULL,
    initiative_slug TEXT NOT NULL,
    decision TEXT NOT NULL,
    requested_by TEXT NOT NULL DEFAULT '',
    requested_by_display TEXT NOT NULL DEFAULT '',
    reviewed_by TEXT NOT NULL DEFAULT '',
    reviewed_by_display TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    decided_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_persuasion_reviews_initiative
    ON persuasion_reviews(initiative_slug, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_persuasion_reviews_version
    ON persuasion_reviews(content_version_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_persuasion_apply_review
    ON persuasion_apply_runs(persuasion_review_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_persuasion_events_review
    ON persuasion_review_events(persuasion_review_id, recorded_at DESC);
  CREATE INDEX IF NOT EXISTS idx_claim_receipts_review
    ON claim_decision_receipts(persuasion_review_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_claim_approvals_review
    ON claim_approvals(persuasion_review_id, created_at DESC);
`);

export { db };
