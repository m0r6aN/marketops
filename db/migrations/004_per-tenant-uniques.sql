-- 004_per-tenant-uniques.sql
-- w2-tenant-wire: convert global UNIQUEs to per-tenant composite UNIQUEs.
--
-- Ruling (already made, do not relitigate): per-tenant UNIQUEs. Shared-read-only
-- catalog ENFORCEMENT is a later H parcel and is NOT built here.
--
-- Audit of global UNIQUEs (source: db/migrations/002_core-schema.sql inline
-- UNIQUEs, cross-checked against the 13 src/lib/*/db.ts SQLite modules, which
-- carry the identical UNIQUE set):
--   1. brand_voice_guidelines          UNIQUE(initiative_slug, version_number)
--   2. content_versions                UNIQUE(content_item_id, version_number)
--   3. customer_finder_campaigns       slug UNIQUE (column-level)
--   4. customer_finder_campaigns       request_fingerprint UNIQUE (column-level)
--   5. customer_finder_source_runs     UNIQUE(campaign_id, source_id)
--   6. customer_finder_candidates      UNIQUE(campaign_id, dedupe_key)
--   7. customer_finder_suppressions    contact_fingerprint UNIQUE (column-level)
--   8. citation_plan_versions          UNIQUE(citation_plan_item_id, version_number)
--   9. email_campaign_versions         UNIQUE(email_campaign_item_id, version_number)
--  10. video_script_versions           UNIQUE(video_script_item_id, version_number)
--
-- Old constraint names below are the PostgreSQL auto-generated names for
-- unnamed inline UNIQUEs (<table>_<columns>_key). They are dropped with
-- IF EXISTS, so re-runs and databases where 002 took a different path stay
-- safe. New composite names are deliberately short (<= 63 bytes, the PG
-- NAMEDATALEN limit) and are added only when absent (DO-guard on
-- pg_constraint), so this file is re-runnable-safe per the
-- src/lib/db/migrate.ts runner conventions (ordered, checksummed, no DOWN
-- migrations; beta rollback is PITR).
--
-- Backfill behavior: NONE required. 002 already backfilled every tenant_id to
-- the explicit, documented 'local-default' (never a silent cross-tenant
-- merge) and declared the columns NOT NULL. Relaxing a global UNIQUE to a
-- per-tenant composite UNIQUE(tenant_id, ...) cannot orphan or invalidate any
-- existing row: rows that were globally distinct remain distinct within their
-- tenant. Local-default rows stay valid; 'local-default' must never appear in
-- beta (runbook beta checks fail if it does).
--
-- Intentionally UNTOUCHED here (H parcel owns the decision + enforcement):
--   * initiatives.slug PRIMARY KEY (global slug namespace; shared catalog TBD)
--   * readiness_state PRIMARY KEY (initiative_slug, definition_id)
-- Changing primary keys requires a table rebuild plus FK migration and a
-- product decision about the shared catalog — explicitly out of scope.
--
-- Operator verification (live PG, beta INT int-tenant-isolation owns proof):
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid IN (SELECT oid FROM pg_class WHERE relkind = 'r'
--     AND relname LIKE '%campaign%' OR relname LIKE '%version%')
--   AND contype = 'u' ORDER BY conname;

-- ── 1. brand_voice_guidelines: (initiative_slug, version_number) → per-tenant ──
ALTER TABLE brand_voice_guidelines
  DROP CONSTRAINT IF EXISTS brand_voice_guidelines_initiative_slug_version_number_key;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'brand_voice_guidelines_tenant_version_key') THEN
    ALTER TABLE brand_voice_guidelines
      ADD CONSTRAINT brand_voice_guidelines_tenant_version_key
      UNIQUE (tenant_id, initiative_slug, version_number);
  END IF;
END $$;

-- ── 2. content_versions: (content_item_id, version_number) → per-tenant ──
ALTER TABLE content_versions
  DROP CONSTRAINT IF EXISTS content_versions_content_item_id_version_number_key;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_versions_tenant_item_version_key') THEN
    ALTER TABLE content_versions
      ADD CONSTRAINT content_versions_tenant_item_version_key
      UNIQUE (tenant_id, content_item_id, version_number);
  END IF;
END $$;

-- ── 3. customer_finder_campaigns.slug → per-tenant ──
ALTER TABLE customer_finder_campaigns
  DROP CONSTRAINT IF EXISTS customer_finder_campaigns_slug_key;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_finder_campaigns_tenant_slug_key') THEN
    ALTER TABLE customer_finder_campaigns
      ADD CONSTRAINT customer_finder_campaigns_tenant_slug_key
      UNIQUE (tenant_id, slug);
  END IF;
END $$;

-- ── 4. customer_finder_campaigns.request_fingerprint → per-tenant ──
ALTER TABLE customer_finder_campaigns
  DROP CONSTRAINT IF EXISTS customer_finder_campaigns_request_fingerprint_key;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_finder_campaigns_tenant_fingerprint_key') THEN
    ALTER TABLE customer_finder_campaigns
      ADD CONSTRAINT customer_finder_campaigns_tenant_fingerprint_key
      UNIQUE (tenant_id, request_fingerprint);
  END IF;
END $$;

-- ── 5. customer_finder_source_runs: (campaign_id, source_id) → per-tenant ──
ALTER TABLE customer_finder_source_runs
  DROP CONSTRAINT IF EXISTS customer_finder_source_runs_campaign_id_source_id_key;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_finder_source_runs_tenant_scoped_key') THEN
    ALTER TABLE customer_finder_source_runs
      ADD CONSTRAINT customer_finder_source_runs_tenant_scoped_key
      UNIQUE (tenant_id, campaign_id, source_id);
  END IF;
END $$;

-- ── 6. customer_finder_candidates: (campaign_id, dedupe_key) → per-tenant ──
ALTER TABLE customer_finder_candidates
  DROP CONSTRAINT IF EXISTS customer_finder_candidates_campaign_id_dedupe_key_key;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_finder_candidates_tenant_dedupe_key') THEN
    ALTER TABLE customer_finder_candidates
      ADD CONSTRAINT customer_finder_candidates_tenant_dedupe_key
      UNIQUE (tenant_id, campaign_id, dedupe_key);
  END IF;
END $$;

-- ── 7. customer_finder_suppressions.contact_fingerprint → per-tenant ──
-- (Column/index/RLS groundwork for this table is re-asserted in 005; the
-- UNIQUE conversion itself lives here with the other per-tenant UNIQUEs.)
ALTER TABLE customer_finder_suppressions
  DROP CONSTRAINT IF EXISTS customer_finder_suppressions_contact_fingerprint_key;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_finder_suppressions_tenant_fp_key') THEN
    ALTER TABLE customer_finder_suppressions
      ADD CONSTRAINT customer_finder_suppressions_tenant_fp_key
      UNIQUE (tenant_id, contact_fingerprint);
  END IF;
END $$;

-- ── 8. citation_plan_versions: (citation_plan_item_id, version_number) → per-tenant ──
ALTER TABLE citation_plan_versions
  DROP CONSTRAINT IF EXISTS citation_plan_versions_citation_plan_item_id_version_number_key;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'citation_plan_versions_tenant_item_ver_key') THEN
    ALTER TABLE citation_plan_versions
      ADD CONSTRAINT citation_plan_versions_tenant_item_ver_key
      UNIQUE (tenant_id, citation_plan_item_id, version_number);
  END IF;
END $$;

-- ── 9. email_campaign_versions: (email_campaign_item_id, version_number) → per-tenant ──
ALTER TABLE email_campaign_versions
  DROP CONSTRAINT IF EXISTS email_campaign_versions_email_campaign_item_id_version_number_key;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_campaign_versions_tenant_item_ver_key') THEN
    ALTER TABLE email_campaign_versions
      ADD CONSTRAINT email_campaign_versions_tenant_item_ver_key
      UNIQUE (tenant_id, email_campaign_item_id, version_number);
  END IF;
END $$;

-- ── 10. video_script_versions: (video_script_item_id, version_number) → per-tenant ──
ALTER TABLE video_script_versions
  DROP CONSTRAINT IF EXISTS video_script_versions_video_script_item_id_version_number_key;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'video_script_versions_tenant_item_ver_key') THEN
    ALTER TABLE video_script_versions
      ADD CONSTRAINT video_script_versions_tenant_item_ver_key
      UNIQUE (tenant_id, video_script_item_id, version_number);
  END IF;
END $$;
