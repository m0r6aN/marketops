import { db } from "@/lib/brand-voice/db";

db.exec(`
  CREATE TABLE IF NOT EXISTS content_items (
    id TEXT PRIMARY KEY,
    initiative_slug TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS content_versions (
    id TEXT PRIMARY KEY,
    content_item_id TEXT NOT NULL,
    initiative_slug TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    channel TEXT NOT NULL DEFAULT '',
    format TEXT NOT NULL DEFAULT '',
    objective TEXT NOT NULL DEFAULT '',
    audience TEXT NOT NULL DEFAULT '',
    offer TEXT NOT NULL DEFAULT '',
    cta TEXT NOT NULL DEFAULT '',
    campaign_id TEXT NOT NULL DEFAULT '',
    brand_voice_guideline_id TEXT NOT NULL DEFAULT '',
    brand_voice_snapshot TEXT NOT NULL DEFAULT '',
    source_materials_json TEXT NOT NULL DEFAULT '[]',
    body TEXT NOT NULL DEFAULT '',
    authorship TEXT NOT NULL DEFAULT 'operator-authored',
    claim_findings_json TEXT NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    approved_at TEXT,
    UNIQUE(content_item_id, version_number)
  );

  CREATE TABLE IF NOT EXISTS content_generation_runs (
    id TEXT PRIMARY KEY,
    content_version_id TEXT NOT NULL,
    status TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    request_summary TEXT NOT NULL,
    result_text TEXT NOT NULL DEFAULT '',
    error_message TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    completed_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS content_events (
    id TEXT PRIMARY KEY,
    content_item_id TEXT NOT NULL,
    content_version_id TEXT NOT NULL,
    initiative_slug TEXT NOT NULL,
    event_type TEXT NOT NULL,
    summary TEXT NOT NULL,
    detail_json TEXT NOT NULL DEFAULT '{}',
    recorded_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_content_versions_initiative
    ON content_versions(initiative_slug, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_content_generation_version
    ON content_generation_runs(content_version_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_content_events_version
    ON content_events(content_version_id, recorded_at DESC);
`);

export { db };
