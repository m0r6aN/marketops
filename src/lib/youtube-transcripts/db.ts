import { db } from "@/lib/content-workspace/db";

db.exec(`
  CREATE TABLE IF NOT EXISTS youtube_transcript_records (
    id TEXT PRIMARY KEY, initiative_slug TEXT NOT NULL, video_id TEXT NOT NULL, source_url TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '', channel TEXT NOT NULL DEFAULT '', language TEXT NOT NULL DEFAULT '',
    transcript_text TEXT NOT NULL DEFAULT '', content_hash TEXT NOT NULL DEFAULT '', status TEXT NOT NULL,
    provider TEXT NOT NULL, provider_version TEXT NOT NULL DEFAULT '', rights_basis TEXT NOT NULL,
    intended_use TEXT NOT NULL, rights_acknowledged_at TEXT NOT NULL, error_message TEXT NOT NULL DEFAULT '', fetched_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_youtube_transcripts_initiative ON youtube_transcript_records(initiative_slug, fetched_at DESC);
`);

export { db };
