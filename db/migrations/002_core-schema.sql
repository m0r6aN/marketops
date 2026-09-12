-- 002_core_schema.sql
-- w1-postgres-rls-migrate: full MarketOps schema with tenant_id on every
-- tenant-scoped table.
--
-- Conventions:
-- * Column definitions are transcribed 1:1 from the 13 src/lib/*/db.ts
--   modules (TEXT/INTEGER/REAL, defaults, UNIQUEs, FKs) with one addition:
--   `tenant_id TEXT NOT NULL` placed right after the primary-key column(s).
--   SQLite defaults are preserved verbatim so PG semantics match local dev.
-- * Upgrade/backfill guard per table (idempotent on fresh databases):
--     ALTER TABLE ... ADD COLUMN IF NOT EXISTS tenant_id TEXT;
--     UPDATE ... SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
--     ALTER TABLE ... ALTER COLUMN tenant_id SET NOT NULL;
--   Pre-tenant local rows therefore land on the explicit, documented
--   'local-default' tenant (see provider DEFAULT_TENANT_ID) — never a silent
--   cross-tenant merge. 'local-default' must never appear in beta; the
--   runbook's beta checks fail if it does.
-- * Fresh tables declare tenant_id NOT NULL with NO default so future writes
--   must supply an explicit tenant (fail-closed).
-- * UNIQUE constraints are kept exactly as in SQLite (global namespace).
--   Open decision (recorded, not decided here): whether slugs/keys that are
--   UNIQUE today must become per-tenant UNIQUE(tenant_id, ...) once beta
--   tenants share one database. See runbook appendix + PR description.
-- * library_* tables include the additive columns from src/lib/library/db.ts
--   (initiative_slug, review fields) exactly once.

-- ─────────────────────────────────────────────────────────────────────────
-- readiness_state — src/lib/readiness/db.ts
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS readiness_state (
  initiative_slug TEXT NOT NULL,
  definition_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  complete INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (initiative_slug, definition_id)
);
ALTER TABLE readiness_state ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE readiness_state SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE readiness_state ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_readiness_state_tenant ON readiness_state(tenant_id);

-- ─────────────────────────────────────────────────────────────────────────
-- initiatives — src/lib/initiatives/db.ts
-- Open decision: initiatives are a global catalog in local mode. In beta each
-- row carries its owning tenant_id; whether beta seeds a shared catalog or a
-- per-tenant copy is owned by the auth/entitlement parcels, not this one.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS initiatives (
  slug TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  stage_key TEXT NOT NULL,
  stage_label TEXT NOT NULL,
  status_key TEXT NOT NULL,
  status_label TEXT NOT NULL,
  one_liner TEXT NOT NULL,
  primary_audiences_json TEXT NOT NULL DEFAULT '[]',
  primary_cta TEXT NOT NULL,
  current_marketing_focus TEXT NOT NULL,
  allowed_claims_json TEXT NOT NULL DEFAULT '[]',
  banned_claims_json TEXT NOT NULL DEFAULT '[]',
  needs_proof_claims_json TEXT NOT NULL DEFAULT '[]',
  claim_posture TEXT NOT NULL,
  narrative TEXT NOT NULL,
  tone_notes TEXT NOT NULL,
  public_url TEXT,
  repo_url TEXT,
  needs_positioning_review INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE initiatives SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE initiatives ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_initiatives_tenant ON initiatives(tenant_id);

-- ─────────────────────────────────────────────────────────────────────────
-- brand_voice_guidelines / brand_voice_events — src/lib/brand-voice/db.ts
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brand_voice_guidelines (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
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
ALTER TABLE brand_voice_guidelines ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE brand_voice_guidelines SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE brand_voice_guidelines ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_brand_voice_guidelines_tenant ON brand_voice_guidelines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_brand_voice_guidelines_initiative
  ON brand_voice_guidelines(initiative_slug, version_number DESC);

CREATE TABLE IF NOT EXISTS brand_voice_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  guideline_id TEXT NOT NULL,
  initiative_slug TEXT NOT NULL,
  event_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  recorded_at TEXT NOT NULL
);
ALTER TABLE brand_voice_events ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE brand_voice_events SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE brand_voice_events ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_brand_voice_events_tenant ON brand_voice_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_brand_voice_events_guideline
  ON brand_voice_events(guideline_id, recorded_at DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- content_items / content_versions / content_generation_runs / content_events
-- src/lib/content-workspace/db.ts
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  initiative_slug TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE content_items SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE content_items ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_items_tenant ON content_items(tenant_id);

CREATE TABLE IF NOT EXISTS content_versions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
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
ALTER TABLE content_versions ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE content_versions SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE content_versions ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_versions_tenant ON content_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_content_versions_initiative
  ON content_versions(initiative_slug, updated_at DESC);

CREATE TABLE IF NOT EXISTS content_generation_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
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
ALTER TABLE content_generation_runs ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE content_generation_runs SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE content_generation_runs ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_generation_runs_tenant ON content_generation_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_content_generation_version
  ON content_generation_runs(content_version_id, created_at DESC);

CREATE TABLE IF NOT EXISTS content_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  content_item_id TEXT NOT NULL,
  content_version_id TEXT NOT NULL,
  initiative_slug TEXT NOT NULL,
  event_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  recorded_at TEXT NOT NULL
);
ALTER TABLE content_events ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE content_events SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE content_events ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_events_tenant ON content_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_content_events_version
  ON content_events(content_version_id, recorded_at DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- customer_finder_* — src/lib/customer-finder/db.ts
-- Open decision: customer_finder_suppressions is a contact-fingerprint
-- denylist. It is modelled per-tenant here for isolation; whether beta wants
-- a global denylist (shared across tenants) is a compliance/product decision
-- owned by a later parcel, not this one.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_finder_campaigns (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
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
ALTER TABLE customer_finder_campaigns ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE customer_finder_campaigns SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE customer_finder_campaigns ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_finder_campaigns_tenant ON customer_finder_campaigns(tenant_id);

CREATE TABLE IF NOT EXISTS customer_finder_source_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
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
ALTER TABLE customer_finder_source_runs ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE customer_finder_source_runs SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE customer_finder_source_runs ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_finder_source_runs_tenant ON customer_finder_source_runs(tenant_id);

CREATE TABLE IF NOT EXISTS customer_finder_candidates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
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
ALTER TABLE customer_finder_candidates ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE customer_finder_candidates SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE customer_finder_candidates ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_finder_candidates_tenant ON customer_finder_candidates(tenant_id);

CREATE TABLE IF NOT EXISTS customer_finder_candidate_provenance (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
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
ALTER TABLE customer_finder_candidate_provenance ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE customer_finder_candidate_provenance SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE customer_finder_candidate_provenance ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_finder_candidate_provenance_tenant ON customer_finder_candidate_provenance(tenant_id);

CREATE TABLE IF NOT EXISTS customer_finder_outreach_drafts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
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
ALTER TABLE customer_finder_outreach_drafts ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE customer_finder_outreach_drafts SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE customer_finder_outreach_drafts ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_finder_outreach_drafts_tenant ON customer_finder_outreach_drafts(tenant_id);

CREATE TABLE IF NOT EXISTS customer_finder_suppressions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  contact_fingerprint TEXT NOT NULL UNIQUE,
  channel TEXT,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);
ALTER TABLE customer_finder_suppressions ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE customer_finder_suppressions SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE customer_finder_suppressions ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_finder_suppressions_tenant ON customer_finder_suppressions(tenant_id);

CREATE TABLE IF NOT EXISTS customer_finder_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES customer_finder_campaigns(id)
);
ALTER TABLE customer_finder_events ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE customer_finder_events SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE customer_finder_events ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_finder_events_tenant ON customer_finder_events(tenant_id);

-- ─────────────────────────────────────────────────────────────────────────
-- discoverability_audits — src/lib/discoverability-audits/db.ts
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS discoverability_audits (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  initiative_slug TEXT NOT NULL,
  requested_url TEXT NOT NULL,
  final_url TEXT NOT NULL,
  source_mode TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_version TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  html_snapshot TEXT NOT NULL,
  seo_coverage INTEGER NOT NULL,
  aeo_coverage INTEGER NOT NULL,
  geo_coverage INTEGER NOT NULL,
  findings_json TEXT NOT NULL,
  error_message TEXT NOT NULL,
  created_at TEXT NOT NULL
);
ALTER TABLE discoverability_audits ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE discoverability_audits SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE discoverability_audits ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_discoverability_audits_tenant ON discoverability_audits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_discoverability_audits_initiative
  ON discoverability_audits(initiative_slug, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- citation_plan_* — src/lib/citation-readiness/db.ts
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS citation_plan_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  initiative_slug TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
ALTER TABLE citation_plan_items ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE citation_plan_items SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE citation_plan_items ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_citation_plan_items_tenant ON citation_plan_items(tenant_id);

CREATE TABLE IF NOT EXISTS citation_plan_versions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  citation_plan_item_id TEXT NOT NULL,
  initiative_slug TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  audit_id TEXT NOT NULL,
  audit_created_at TEXT NOT NULL,
  target_url TEXT NOT NULL,
  audit_content_hash TEXT NOT NULL,
  audit_findings_json TEXT NOT NULL,
  target_question TEXT NOT NULL,
  concise_answer TEXT NOT NULL,
  entity_definition TEXT NOT NULL,
  sources_json TEXT NOT NULL,
  claims_json TEXT NOT NULL,
  recommended_changes_json TEXT NOT NULL,
  structured_data_plan TEXT NOT NULL,
  authorship_plan TEXT NOT NULL,
  freshness_plan TEXT NOT NULL,
  internal_link_plan TEXT NOT NULL,
  monitoring_queries_json TEXT NOT NULL,
  claim_findings_json TEXT NOT NULL,
  notes TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  approved_at TEXT,
  UNIQUE(citation_plan_item_id, version_number)
);
ALTER TABLE citation_plan_versions ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE citation_plan_versions SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE citation_plan_versions ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_citation_plan_versions_tenant ON citation_plan_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_citation_plans_initiative
  ON citation_plan_versions(initiative_slug, updated_at DESC);

CREATE TABLE IF NOT EXISTS citation_plan_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  citation_plan_item_id TEXT NOT NULL,
  citation_plan_version_id TEXT NOT NULL,
  initiative_slug TEXT NOT NULL,
  event_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  detail_json TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);
ALTER TABLE citation_plan_events ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE citation_plan_events SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE citation_plan_events ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_citation_plan_events_tenant ON citation_plan_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_citation_events_version
  ON citation_plan_events(citation_plan_version_id, recorded_at DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- email_campaign_* — src/lib/email-campaigns/db.ts
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_campaign_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  initiative_slug TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
ALTER TABLE email_campaign_items ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE email_campaign_items SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE email_campaign_items ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_campaign_items_tenant ON email_campaign_items(tenant_id);

CREATE TABLE IF NOT EXISTS email_campaign_versions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  email_campaign_item_id TEXT NOT NULL,
  initiative_slug TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  objective TEXT NOT NULL,
  audience_segment TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  reply_to TEXT NOT NULL,
  consent_basis TEXT NOT NULL,
  suppression_plan TEXT NOT NULL,
  unsubscribe_plan TEXT NOT NULL,
  sender_authentication_plan TEXT NOT NULL,
  physical_address_plan TEXT NOT NULL,
  primary_metric TEXT NOT NULL,
  secondary_metrics_json TEXT NOT NULL,
  attribution_window_days INTEGER NOT NULL,
  steps_json TEXT NOT NULL,
  notes TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  approved_at TEXT,
  UNIQUE(email_campaign_item_id, version_number)
);
ALTER TABLE email_campaign_versions ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE email_campaign_versions SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE email_campaign_versions ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_campaign_versions_tenant ON email_campaign_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_initiative
  ON email_campaign_versions(initiative_slug, updated_at DESC);

CREATE TABLE IF NOT EXISTS email_campaign_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  email_campaign_item_id TEXT NOT NULL,
  email_campaign_version_id TEXT NOT NULL,
  initiative_slug TEXT NOT NULL,
  event_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  detail_json TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);
ALTER TABLE email_campaign_events ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE email_campaign_events SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE email_campaign_events ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_campaign_events_tenant ON email_campaign_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_campaign_events_version
  ON email_campaign_events(email_campaign_version_id, recorded_at DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- campaigns / campaign_lifecycles / campaign_lifecycle_events
-- src/lib/campaigns/db.ts (includes brand_voice_guideline_id backfill column)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  initiative_slug TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  goal TEXT NOT NULL,
  channel TEXT NOT NULL,
  audience TEXT NOT NULL,
  primary_cta TEXT NOT NULL,
  current_focus TEXT NOT NULL,
  asset_types_json TEXT NOT NULL DEFAULT '[]',
  claim_sensitivity TEXT NOT NULL,
  launch_readiness TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE campaigns SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE campaigns ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON campaigns(tenant_id);

CREATE TABLE IF NOT EXISTS campaign_lifecycles (
  campaign_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  brief TEXT NOT NULL DEFAULT '',
  offer TEXT NOT NULL DEFAULT '',
  audience_segment TEXT NOT NULL DEFAULT '',
  selected_candidate_ids_json TEXT NOT NULL DEFAULT '[]',
  brand_voice_guideline_id TEXT NOT NULL DEFAULT '',
  brand_voice_summary TEXT NOT NULL DEFAULT '',
  asset_plan_json TEXT NOT NULL DEFAULT '[]',
  channel_plan TEXT NOT NULL DEFAULT '',
  outreach_plan TEXT NOT NULL DEFAULT '',
  review_status TEXT NOT NULL DEFAULT 'draft',
  execution_mode TEXT NOT NULL DEFAULT 'manual',
  execution_status TEXT NOT NULL DEFAULT 'not-started',
  execution_evidence TEXT NOT NULL DEFAULT '',
  measurement_plan TEXT NOT NULL DEFAULT '',
  primary_metric TEXT NOT NULL DEFAULT '',
  target_value TEXT NOT NULL DEFAULT '',
  actual_outcome TEXT NOT NULL DEFAULT '',
  optimization_notes TEXT NOT NULL DEFAULT '',
  next_iteration TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
ALTER TABLE campaign_lifecycles ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE campaign_lifecycles SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE campaign_lifecycles ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_lifecycles_tenant ON campaign_lifecycles(tenant_id);

CREATE TABLE IF NOT EXISTS campaign_lifecycle_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  recorded_at TEXT NOT NULL
);
ALTER TABLE campaign_lifecycle_events ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE campaign_lifecycle_events SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE campaign_lifecycle_events ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_lifecycle_events_tenant ON campaign_lifecycle_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaign_lifecycle_events_campaign
  ON campaign_lifecycle_events(campaign_id, recorded_at DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- library_* — src/lib/library/db.ts (base DDL + additive columns, deduped:
-- client_relative_path appears in both; defined once here)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS library_import_batches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  initiative_slug TEXT,
  selected_modes TEXT NOT NULL DEFAULT '[]',
  model_strategy TEXT NOT NULL DEFAULT 'auto',
  status TEXT NOT NULL DEFAULT 'pending',
  total_files INTEGER NOT NULL DEFAULT 0,
  processed_files INTEGER NOT NULL DEFAULT 0,
  failed_files INTEGER NOT NULL DEFAULT 0,
  entries_extracted INTEGER NOT NULL DEFAULT 0,
  trash_candidates INTEGER NOT NULL DEFAULT 0,
  files_moved_to_trash INTEGER NOT NULL DEFAULT 0,
  conflicts_detected INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL
);
ALTER TABLE library_import_batches ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE library_import_batches SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE library_import_batches ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE library_import_batches ADD COLUMN IF NOT EXISTS initiative_slug TEXT;
CREATE INDEX IF NOT EXISTS idx_library_import_batches_tenant ON library_import_batches(tenant_id);

CREATE TABLE IF NOT EXISTS library_source_documents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  import_batch_id TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  client_relative_path TEXT,
  mime_type TEXT,
  file_size INTEGER,
  content_hash TEXT,
  raw_text TEXT,
  parser_status TEXT NOT NULL DEFAULT 'pending',
  processing_status TEXT NOT NULL DEFAULT 'pending',
  usefulness_score REAL NOT NULL DEFAULT 0,
  trash_recommendation INTEGER NOT NULL DEFAULT 0,
  trash_reason TEXT,
  moved_to_trash_at TEXT,
  restored_at TEXT,
  error_message TEXT,
  ingested_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (import_batch_id) REFERENCES library_import_batches(id)
);
ALTER TABLE library_source_documents ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE library_source_documents SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE library_source_documents ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_library_source_documents_tenant ON library_source_documents(tenant_id);

CREATE TABLE IF NOT EXISTS library_entries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source_document_id TEXT NOT NULL,
  import_batch_id TEXT NOT NULL,
  initiative_slug TEXT,
  entry_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  visibility TEXT NOT NULL DEFAULT 'private',
  status TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  confidence_score REAL NOT NULL DEFAULT 0,
  memory_value_score REAL NOT NULL DEFAULT 0,
  public_safe INTEGER NOT NULL DEFAULT 0,
  sensitive INTEGER NOT NULL DEFAULT 0,
  source_quote TEXT,
  source_location TEXT,
  model_used TEXT,
  canon_category TEXT,
  canonical_statement TEXT,
  locked INTEGER NOT NULL DEFAULT 0,
  conflict_status TEXT,
  public_automation_allowed INTEGER NOT NULL DEFAULT 0,
  copy_text TEXT,
  suggested_channel TEXT,
  suggested_use TEXT,
  emotional_angle TEXT,
  audience TEXT,
  approved_for_automation INTEGER NOT NULL DEFAULT 0,
  internal_category TEXT,
  sensitivity_level TEXT,
  why_it_matters TEXT,
  review_priority TEXT,
  source_section TEXT,
  source_excerpt TEXT,
  marketing_angle TEXT,
  suggested_rewrite TEXT,
  use_for TEXT,
  review_audience TEXT,
  funnel_stage TEXT,
  content_type TEXT,
  review_confidence TEXT,
  proof_strength TEXT,
  claim_risk TEXT,
  link_back_required INTEGER NOT NULL DEFAULT 0,
  review_summary_id TEXT,
  rubric_version TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (source_document_id) REFERENCES library_source_documents(id),
  FOREIGN KEY (import_batch_id) REFERENCES library_import_batches(id)
);
ALTER TABLE library_entries ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE library_entries SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE library_entries ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE library_entries ADD COLUMN IF NOT EXISTS initiative_slug TEXT;
ALTER TABLE library_entries ADD COLUMN IF NOT EXISTS source_section TEXT;
ALTER TABLE library_entries ADD COLUMN IF NOT EXISTS source_excerpt TEXT;
ALTER TABLE library_entries ADD COLUMN IF NOT EXISTS marketing_angle TEXT;
ALTER TABLE library_entries ADD COLUMN IF NOT EXISTS suggested_rewrite TEXT;
ALTER TABLE library_entries ADD COLUMN IF NOT EXISTS use_for TEXT;
ALTER TABLE library_entries ADD COLUMN IF NOT EXISTS review_audience TEXT;
ALTER TABLE library_entries ADD COLUMN IF NOT EXISTS funnel_stage TEXT;
ALTER TABLE library_entries ADD COLUMN IF NOT EXISTS content_type TEXT;
ALTER TABLE library_entries ADD COLUMN IF NOT EXISTS review_confidence TEXT;
ALTER TABLE library_entries ADD COLUMN IF NOT EXISTS proof_strength TEXT;
ALTER TABLE library_entries ADD COLUMN IF NOT EXISTS claim_risk TEXT;
ALTER TABLE library_entries ADD COLUMN IF NOT EXISTS link_back_required INTEGER DEFAULT 0;
ALTER TABLE library_entries ADD COLUMN IF NOT EXISTS review_summary_id TEXT;
ALTER TABLE library_entries ADD COLUMN IF NOT EXISTS rubric_version TEXT;
CREATE INDEX IF NOT EXISTS idx_library_entries_tenant ON library_entries(tenant_id);

CREATE TABLE IF NOT EXISTS library_conflicts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  existing_entry_id TEXT NOT NULL,
  challenger_entry_id TEXT NOT NULL,
  conflict_reason TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'minor',
  resolution TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (existing_entry_id) REFERENCES library_entries(id),
  FOREIGN KEY (challenger_entry_id) REFERENCES library_entries(id)
);
ALTER TABLE library_conflicts ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE library_conflicts SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE library_conflicts ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_library_conflicts_tenant ON library_conflicts(tenant_id);

CREATE TABLE IF NOT EXISTS library_trash_records (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source_document_id TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  reason TEXT NOT NULL,
  confidence_score REAL NOT NULL DEFAULT 0,
  import_batch_id TEXT NOT NULL,
  moved_at TEXT NOT NULL,
  restored_at TEXT,
  restore_available INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (source_document_id) REFERENCES library_source_documents(id),
  FOREIGN KEY (import_batch_id) REFERENCES library_import_batches(id)
);
ALTER TABLE library_trash_records ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE library_trash_records SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE library_trash_records ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_library_trash_records_tenant ON library_trash_records(tenant_id);

CREATE TABLE IF NOT EXISTS library_marketing_review_summaries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source_document_id TEXT NOT NULL,
  import_batch_id TEXT NOT NULL,
  overall_score INTEGER NOT NULL DEFAULT 0,
  best_marketing_uses TEXT NOT NULL DEFAULT '[]',
  highest_value_theme TEXT,
  rubric_version TEXT NOT NULL DEFAULT 'docs-as-marketing.v1',
  reviewed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (source_document_id) REFERENCES library_source_documents(id),
  FOREIGN KEY (import_batch_id) REFERENCES library_import_batches(id)
);
ALTER TABLE library_marketing_review_summaries ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE library_marketing_review_summaries SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE library_marketing_review_summaries ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_library_marketing_review_summaries_tenant ON library_marketing_review_summaries(tenant_id);

CREATE TABLE IF NOT EXISTS library_marketing_red_flags (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source_document_id TEXT NOT NULL,
  review_summary_id TEXT,
  library_entry_id TEXT,
  source_excerpt TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  issue TEXT NOT NULL,
  safer_wording TEXT,
  proof_requirement TEXT,
  resolved_at TEXT,
  resolution_note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (source_document_id) REFERENCES library_source_documents(id),
  FOREIGN KEY (review_summary_id) REFERENCES library_marketing_review_summaries(id),
  FOREIGN KEY (library_entry_id) REFERENCES library_entries(id)
);
ALTER TABLE library_marketing_red_flags ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE library_marketing_red_flags SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE library_marketing_red_flags ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_library_marketing_red_flags_tenant ON library_marketing_red_flags(tenant_id);

CREATE TABLE IF NOT EXISTS library_marketing_asset_opportunities (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source_document_id TEXT NOT NULL,
  review_summary_id TEXT,
  asset_type TEXT NOT NULL,
  theme TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'Medium',
  status TEXT NOT NULL DEFAULT 'proposed',
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (source_document_id) REFERENCES library_source_documents(id),
  FOREIGN KEY (review_summary_id) REFERENCES library_marketing_review_summaries(id)
);
ALTER TABLE library_marketing_asset_opportunities ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE library_marketing_asset_opportunities SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE library_marketing_asset_opportunities ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_library_marketing_asset_opportunities_tenant ON library_marketing_asset_opportunities(tenant_id);

-- ─────────────────────────────────────────────────────────────────────────
-- persuasion_reviews / persuasion_apply_runs / persuasion_review_events
-- src/lib/persuasion-review/db.ts
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS persuasion_reviews (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
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
ALTER TABLE persuasion_reviews ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE persuasion_reviews SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE persuasion_reviews ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_persuasion_reviews_tenant ON persuasion_reviews(tenant_id);
CREATE INDEX IF NOT EXISTS idx_persuasion_reviews_initiative
  ON persuasion_reviews(initiative_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_persuasion_reviews_version
  ON persuasion_reviews(content_version_id, created_at DESC);

CREATE TABLE IF NOT EXISTS persuasion_apply_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  persuasion_review_id TEXT NOT NULL,
  source_content_version_id TEXT NOT NULL,
  target_content_version_id TEXT,
  status TEXT NOT NULL,
  summary TEXT NOT NULL,
  error_message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  completed_at TEXT NOT NULL
);
ALTER TABLE persuasion_apply_runs ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE persuasion_apply_runs SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE persuasion_apply_runs ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_persuasion_apply_runs_tenant ON persuasion_apply_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_persuasion_apply_review
  ON persuasion_apply_runs(persuasion_review_id, created_at DESC);

CREATE TABLE IF NOT EXISTS persuasion_review_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  persuasion_review_id TEXT NOT NULL,
  initiative_slug TEXT NOT NULL,
  content_version_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  recorded_at TEXT NOT NULL
);
ALTER TABLE persuasion_review_events ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE persuasion_review_events SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE persuasion_review_events ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_persuasion_review_events_tenant ON persuasion_review_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_persuasion_events_review
  ON persuasion_review_events(persuasion_review_id, recorded_at DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- video_script_* — src/lib/video-scripts/db.ts
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS video_script_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  initiative_slug TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
ALTER TABLE video_script_items ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE video_script_items SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE video_script_items ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_video_script_items_tenant ON video_script_items(tenant_id);

CREATE TABLE IF NOT EXISTS video_script_versions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  video_script_item_id TEXT NOT NULL,
  initiative_slug TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  platform TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  objective TEXT NOT NULL,
  audience TEXT NOT NULL,
  campaign_id TEXT NOT NULL DEFAULT '',
  source_content_version_id TEXT NOT NULL,
  source_content_updated_at TEXT NOT NULL,
  source_content_title TEXT NOT NULL,
  source_content_body TEXT NOT NULL,
  source_materials_json TEXT NOT NULL DEFAULT '[]',
  brand_voice_guideline_id TEXT NOT NULL,
  brand_voice_snapshot TEXT NOT NULL,
  scenes_json TEXT NOT NULL DEFAULT '[]',
  caption TEXT NOT NULL DEFAULT '',
  cta TEXT NOT NULL DEFAULT '',
  claim_findings_json TEXT NOT NULL DEFAULT '[]',
  origin TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  approved_at TEXT,
  UNIQUE(video_script_item_id, version_number)
);
ALTER TABLE video_script_versions ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE video_script_versions SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE video_script_versions ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_video_script_versions_tenant ON video_script_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_video_scripts_initiative
  ON video_script_versions(initiative_slug, updated_at DESC);

CREATE TABLE IF NOT EXISTS video_script_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  video_script_item_id TEXT NOT NULL,
  video_script_version_id TEXT NOT NULL,
  initiative_slug TEXT NOT NULL,
  event_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  recorded_at TEXT NOT NULL
);
ALTER TABLE video_script_events ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE video_script_events SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE video_script_events ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_video_script_events_tenant ON video_script_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_video_events_version
  ON video_script_events(video_script_version_id, recorded_at DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- youtube_transcript_records — src/lib/youtube-transcripts/db.ts
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS youtube_transcript_records (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  initiative_slug TEXT NOT NULL,
  video_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT '',
  transcript_text TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_version TEXT NOT NULL DEFAULT '',
  rights_basis TEXT NOT NULL,
  intended_use TEXT NOT NULL,
  rights_acknowledged_at TEXT NOT NULL,
  error_message TEXT NOT NULL DEFAULT '',
  fetched_at TEXT NOT NULL
);
ALTER TABLE youtube_transcript_records ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE youtube_transcript_records SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE youtube_transcript_records ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_youtube_transcript_records_tenant ON youtube_transcript_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_youtube_transcripts_initiative
  ON youtube_transcript_records(initiative_slug, fetched_at DESC);
