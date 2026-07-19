import { db } from "@/lib/initiatives/db";

db.exec(`
  CREATE TABLE IF NOT EXISTS brand_voice_guidelines (
    id TEXT PRIMARY KEY,
    initiative_slug TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    source_materials_json TEXT NOT NULL DEFAULT '[]',
    audience_summary TEXT NOT NULL DEFAULT '',
    positioning_summary TEXT NOT NULL DEFAULT '',
    tone_attributes_json TEXT NOT NULL DEFAULT '[]',
    allowed_language_json TEXT NOT NULL DEFAULT '[]',
    discouraged_language_json TEXT NOT NULL DEFAULT '[]',
    claim_boundaries_json TEXT NOT NULL DEFAULT '[]',
    example_pairs_json TEXT NOT NULL DEFAULT '[]',
    channel_variations_json TEXT NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    approved_at TEXT,
    UNIQUE(initiative_slug, version_number)
  );

  CREATE INDEX IF NOT EXISTS idx_brand_voice_guidelines_initiative
    ON brand_voice_guidelines(initiative_slug, version_number DESC);

  CREATE TABLE IF NOT EXISTS brand_voice_events (
    id TEXT PRIMARY KEY,
    guideline_id TEXT NOT NULL,
    initiative_slug TEXT NOT NULL,
    event_type TEXT NOT NULL,
    summary TEXT NOT NULL,
    detail_json TEXT NOT NULL DEFAULT '{}',
    recorded_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_brand_voice_events_guideline
    ON brand_voice_events(guideline_id, recorded_at DESC);
`);

export { db };
