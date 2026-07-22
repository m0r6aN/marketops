import { db } from "@/lib/content-workspace/db";

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

  CREATE INDEX IF NOT EXISTS idx_persuasion_reviews_initiative
    ON persuasion_reviews(initiative_slug, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_persuasion_reviews_version
    ON persuasion_reviews(content_version_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_persuasion_apply_review
    ON persuasion_apply_runs(persuasion_review_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_persuasion_events_review
    ON persuasion_review_events(persuasion_review_id, recorded_at DESC);
`);

export { db };
