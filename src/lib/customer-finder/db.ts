import { db } from "@/lib/readiness/db";

db.exec(`
  CREATE TABLE IF NOT EXISTS customer_finder_campaigns (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    campaign_name TEXT NOT NULL,
    initiative_slug TEXT NOT NULL,
    origin_prompt TEXT NOT NULL,
    target_description TEXT NOT NULL,
    normalized_target_description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planning',
    discovery_status TEXT NOT NULL DEFAULT 'pending',
    selected_channels TEXT NOT NULL DEFAULT '[]',
    request_fingerprint TEXT NOT NULL UNIQUE,
    provenance_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    retention_expires_at TEXT NOT NULL,
    last_processed_at TEXT,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS customer_finder_source_runs (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_label TEXT NOT NULL,
    support_level TEXT NOT NULL,
    selected INTEGER NOT NULL DEFAULT 0,
    processing_status TEXT NOT NULL DEFAULT 'pending',
    rationale TEXT NOT NULL,
    availability_note TEXT,
    input_text TEXT,
    result_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    processed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(campaign_id, source_id),
    FOREIGN KEY (campaign_id) REFERENCES customer_finder_campaigns(id)
  );

  CREATE TABLE IF NOT EXISTS customer_finder_candidates (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    dedupe_key TEXT NOT NULL,
    candidate_kind TEXT NOT NULL,
    display_name TEXT NOT NULL,
    organization_name TEXT,
    source_summary TEXT NOT NULL DEFAULT '',
    match_reason TEXT NOT NULL,
    verified_evidence TEXT NOT NULL,
    confidence_label TEXT NOT NULL,
    confidence_score REAL NOT NULL DEFAULT 0,
    contact_channel TEXT,
    contact_value TEXT,
    factual_status TEXT NOT NULL DEFAULT 'verified',
    inferred_notes TEXT,
    discovery_timestamp TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(campaign_id, dedupe_key),
    FOREIGN KEY (campaign_id) REFERENCES customer_finder_campaigns(id)
  );

  CREATE TABLE IF NOT EXISTS customer_finder_candidate_provenance (
    id TEXT PRIMARY KEY,
    candidate_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_label TEXT NOT NULL,
    source_url TEXT,
    reason TEXT NOT NULL,
    evidence_text TEXT NOT NULL,
    confidence_score REAL NOT NULL DEFAULT 0,
    contact_channel TEXT,
    contact_value TEXT,
    discovered_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (candidate_id) REFERENCES customer_finder_candidates(id)
  );

  CREATE TABLE IF NOT EXISTS customer_finder_outreach_drafts (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    candidate_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    subject_line TEXT,
    message_body TEXT NOT NULL,
    approval_status TEXT NOT NULL DEFAULT 'review-required',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (campaign_id) REFERENCES customer_finder_campaigns(id),
    FOREIGN KEY (candidate_id) REFERENCES customer_finder_candidates(id)
  );

  CREATE TABLE IF NOT EXISTS customer_finder_suppressions (
    id TEXT PRIMARY KEY,
    contact_fingerprint TEXT NOT NULL UNIQUE,
    channel TEXT,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS customer_finder_events (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    summary TEXT NOT NULL,
    detail_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (campaign_id) REFERENCES customer_finder_campaigns(id)
  );
`);

export { db };
