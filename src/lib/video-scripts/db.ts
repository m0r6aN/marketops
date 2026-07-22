import { db } from "@/lib/content-workspace/db";

db.exec(`
  CREATE TABLE IF NOT EXISTS video_script_items (id TEXT PRIMARY KEY, initiative_slug TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS video_script_versions (
    id TEXT PRIMARY KEY, video_script_item_id TEXT NOT NULL, initiative_slug TEXT NOT NULL, version_number INTEGER NOT NULL,
    title TEXT NOT NULL, status TEXT NOT NULL, platform TEXT NOT NULL, aspect_ratio TEXT NOT NULL, duration_seconds INTEGER NOT NULL,
    objective TEXT NOT NULL, audience TEXT NOT NULL, campaign_id TEXT NOT NULL DEFAULT '', source_content_version_id TEXT NOT NULL,
    source_content_updated_at TEXT NOT NULL, source_content_title TEXT NOT NULL, source_content_body TEXT NOT NULL,
    source_materials_json TEXT NOT NULL DEFAULT '[]', brand_voice_guideline_id TEXT NOT NULL, brand_voice_snapshot TEXT NOT NULL,
    scenes_json TEXT NOT NULL DEFAULT '[]', caption TEXT NOT NULL DEFAULT '', cta TEXT NOT NULL DEFAULT '', claim_findings_json TEXT NOT NULL DEFAULT '[]',
    origin TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, approved_at TEXT,
    UNIQUE(video_script_item_id, version_number)
  );
  CREATE TABLE IF NOT EXISTS video_script_events (
    id TEXT PRIMARY KEY, video_script_item_id TEXT NOT NULL, video_script_version_id TEXT NOT NULL, initiative_slug TEXT NOT NULL,
    event_type TEXT NOT NULL, summary TEXT NOT NULL, detail_json TEXT NOT NULL DEFAULT '{}', recorded_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_video_scripts_initiative ON video_script_versions(initiative_slug, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_video_events_version ON video_script_events(video_script_version_id, recorded_at DESC);
`);

export { db };
