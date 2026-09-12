-- 003_rls_policies.sql
-- w1-postgres-rls-migrate: Row-Level Security — tenant isolation.
--
-- Model: every tenant-scoped table carries tenant_id (see 002). Each table
-- gets FORCE ROW LEVEL SECURITY plus a single FOR ALL policy:
--   USING (tenant_id = current_setting('app.tenant_id', true))
--   WITH CHECK (tenant_id = current_setting('app.tenant_id', true))
-- so reads AND writes are confined to the requesting tenant.
--
-- Fail-closed properties:
-- * RLS is FORCE: it applies to the table owner as well as the app role.
-- * When app.tenant_id is unset, current_setting(..., true) returns NULL and
--   the comparison matches zero rows — deny by default, never fail-open.
-- * The app sets app.tenant_id via SET LOCAL per transaction only
--   (see src/lib/db/provider.ts queryWithTenant); it never issues SET GLOBAL.
-- * schema_migrations is intentionally NOT covered: migration bookkeeping is
--   owner-only (runbook revokes app-role access).
-- * tenants exposes a self-read policy only: a tenant may read its own
--   registry row; tenant writes stay owner-only (no INSERT/UPDATE/DELETE
--   policy for the app role).

-- ── tenants: self-read only ──────────────────────────────────────────────
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenants_self_read ON tenants;
CREATE POLICY tenants_self_read ON tenants
  FOR SELECT TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true));

-- ── readiness_state ──────────────────────────────────────────────────────
ALTER TABLE readiness_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE readiness_state FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS readiness_state_tenant_isolation ON readiness_state;
CREATE POLICY readiness_state_tenant_isolation ON readiness_state
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- ── initiatives ──────────────────────────────────────────────────────────
ALTER TABLE initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE initiatives FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS initiatives_tenant_isolation ON initiatives;
CREATE POLICY initiatives_tenant_isolation ON initiatives
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- ── brand_voice_* ────────────────────────────────────────────────────────
ALTER TABLE brand_voice_guidelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_voice_guidelines FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS brand_voice_guidelines_tenant_isolation ON brand_voice_guidelines;
CREATE POLICY brand_voice_guidelines_tenant_isolation ON brand_voice_guidelines
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE brand_voice_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_voice_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS brand_voice_events_tenant_isolation ON brand_voice_events;
CREATE POLICY brand_voice_events_tenant_isolation ON brand_voice_events
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- ── content_workspace_* ──────────────────────────────────────────────────
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS content_items_tenant_isolation ON content_items;
CREATE POLICY content_items_tenant_isolation ON content_items
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE content_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_versions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS content_versions_tenant_isolation ON content_versions;
CREATE POLICY content_versions_tenant_isolation ON content_versions
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE content_generation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_generation_runs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS content_generation_runs_tenant_isolation ON content_generation_runs;
CREATE POLICY content_generation_runs_tenant_isolation ON content_generation_runs
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE content_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS content_events_tenant_isolation ON content_events;
CREATE POLICY content_events_tenant_isolation ON content_events
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- ── customer_finder_* ────────────────────────────────────────────────────
ALTER TABLE customer_finder_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_finder_campaigns FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customer_finder_campaigns_tenant_isolation ON customer_finder_campaigns;
CREATE POLICY customer_finder_campaigns_tenant_isolation ON customer_finder_campaigns
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE customer_finder_source_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_finder_source_runs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customer_finder_source_runs_tenant_isolation ON customer_finder_source_runs;
CREATE POLICY customer_finder_source_runs_tenant_isolation ON customer_finder_source_runs
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE customer_finder_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_finder_candidates FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customer_finder_candidates_tenant_isolation ON customer_finder_candidates;
CREATE POLICY customer_finder_candidates_tenant_isolation ON customer_finder_candidates
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE customer_finder_candidate_provenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_finder_candidate_provenance FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customer_finder_candidate_provenance_tenant_isolation ON customer_finder_candidate_provenance;
CREATE POLICY customer_finder_candidate_provenance_tenant_isolation ON customer_finder_candidate_provenance
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE customer_finder_outreach_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_finder_outreach_drafts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customer_finder_outreach_drafts_tenant_isolation ON customer_finder_outreach_drafts;
CREATE POLICY customer_finder_outreach_drafts_tenant_isolation ON customer_finder_outreach_drafts
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE customer_finder_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_finder_suppressions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customer_finder_suppressions_tenant_isolation ON customer_finder_suppressions;
CREATE POLICY customer_finder_suppressions_tenant_isolation ON customer_finder_suppressions
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE customer_finder_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_finder_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customer_finder_events_tenant_isolation ON customer_finder_events;
CREATE POLICY customer_finder_events_tenant_isolation ON customer_finder_events
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- ── discoverability_audits ───────────────────────────────────────────────
ALTER TABLE discoverability_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE discoverability_audits FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS discoverability_audits_tenant_isolation ON discoverability_audits;
CREATE POLICY discoverability_audits_tenant_isolation ON discoverability_audits
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- ── citation_plan_* ──────────────────────────────────────────────────────
ALTER TABLE citation_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE citation_plan_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citation_plan_items_tenant_isolation ON citation_plan_items;
CREATE POLICY citation_plan_items_tenant_isolation ON citation_plan_items
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE citation_plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE citation_plan_versions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citation_plan_versions_tenant_isolation ON citation_plan_versions;
CREATE POLICY citation_plan_versions_tenant_isolation ON citation_plan_versions
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE citation_plan_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE citation_plan_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citation_plan_events_tenant_isolation ON citation_plan_events;
CREATE POLICY citation_plan_events_tenant_isolation ON citation_plan_events
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- ── email_campaign_* ─────────────────────────────────────────────────────
ALTER TABLE email_campaign_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaign_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS email_campaign_items_tenant_isolation ON email_campaign_items;
CREATE POLICY email_campaign_items_tenant_isolation ON email_campaign_items
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE email_campaign_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaign_versions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS email_campaign_versions_tenant_isolation ON email_campaign_versions;
CREATE POLICY email_campaign_versions_tenant_isolation ON email_campaign_versions
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE email_campaign_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaign_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS email_campaign_events_tenant_isolation ON email_campaign_events;
CREATE POLICY email_campaign_events_tenant_isolation ON email_campaign_events
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- ── campaigns / campaign_lifecycles / campaign_lifecycle_events ──────────
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campaigns_tenant_isolation ON campaigns;
CREATE POLICY campaigns_tenant_isolation ON campaigns
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE campaign_lifecycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_lifecycles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campaign_lifecycles_tenant_isolation ON campaign_lifecycles;
CREATE POLICY campaign_lifecycles_tenant_isolation ON campaign_lifecycles
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE campaign_lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_lifecycle_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campaign_lifecycle_events_tenant_isolation ON campaign_lifecycle_events;
CREATE POLICY campaign_lifecycle_events_tenant_isolation ON campaign_lifecycle_events
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- ── library_* ────────────────────────────────────────────────────────────
ALTER TABLE library_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_import_batches FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS library_import_batches_tenant_isolation ON library_import_batches;
CREATE POLICY library_import_batches_tenant_isolation ON library_import_batches
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE library_source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_source_documents FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS library_source_documents_tenant_isolation ON library_source_documents;
CREATE POLICY library_source_documents_tenant_isolation ON library_source_documents
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE library_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_entries FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS library_entries_tenant_isolation ON library_entries;
CREATE POLICY library_entries_tenant_isolation ON library_entries
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE library_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_conflicts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS library_conflicts_tenant_isolation ON library_conflicts;
CREATE POLICY library_conflicts_tenant_isolation ON library_conflicts
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE library_trash_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_trash_records FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS library_trash_records_tenant_isolation ON library_trash_records;
CREATE POLICY library_trash_records_tenant_isolation ON library_trash_records
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE library_marketing_review_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_marketing_review_summaries FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS library_marketing_review_summaries_tenant_isolation ON library_marketing_review_summaries;
CREATE POLICY library_marketing_review_summaries_tenant_isolation ON library_marketing_review_summaries
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE library_marketing_red_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_marketing_red_flags FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS library_marketing_red_flags_tenant_isolation ON library_marketing_red_flags;
CREATE POLICY library_marketing_red_flags_tenant_isolation ON library_marketing_red_flags
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE library_marketing_asset_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_marketing_asset_opportunities FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS library_marketing_asset_opportunities_tenant_isolation ON library_marketing_asset_opportunities;
CREATE POLICY library_marketing_asset_opportunities_tenant_isolation ON library_marketing_asset_opportunities
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- ── persuasion_review_* ──────────────────────────────────────────────────
ALTER TABLE persuasion_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE persuasion_reviews FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS persuasion_reviews_tenant_isolation ON persuasion_reviews;
CREATE POLICY persuasion_reviews_tenant_isolation ON persuasion_reviews
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE persuasion_apply_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE persuasion_apply_runs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS persuasion_apply_runs_tenant_isolation ON persuasion_apply_runs;
CREATE POLICY persuasion_apply_runs_tenant_isolation ON persuasion_apply_runs
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE persuasion_review_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE persuasion_review_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS persuasion_review_events_tenant_isolation ON persuasion_review_events;
CREATE POLICY persuasion_review_events_tenant_isolation ON persuasion_review_events
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- ── video_script_* ───────────────────────────────────────────────────────
ALTER TABLE video_script_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_script_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS video_script_items_tenant_isolation ON video_script_items;
CREATE POLICY video_script_items_tenant_isolation ON video_script_items
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE video_script_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_script_versions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS video_script_versions_tenant_isolation ON video_script_versions;
CREATE POLICY video_script_versions_tenant_isolation ON video_script_versions
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE video_script_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_script_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS video_script_events_tenant_isolation ON video_script_events;
CREATE POLICY video_script_events_tenant_isolation ON video_script_events
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- ── youtube_transcript_records ───────────────────────────────────────────
ALTER TABLE youtube_transcript_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_transcript_records FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS youtube_transcript_records_tenant_isolation ON youtube_transcript_records;
CREATE POLICY youtube_transcript_records_tenant_isolation ON youtube_transcript_records
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
