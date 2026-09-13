-- 005_suppression-tenant.sql
-- w2-tenant-wire: per-tenant suppression store (defensive re-assertion).
--
-- Ruling (already made, do not relitigate): suppression store is per-tenant.
-- Consent mapping is a later H parcel and is NOT built here.
--
-- State of the world: db/migrations/002_core-schema.sql already declares
-- customer_finder_suppressions WITH tenant_id TEXT NOT NULL (fresh databases),
-- and db/migrations/003_rls-policies.sql already covers this table with the
-- standard tenant-isolation policy. This file therefore re-asserts that ground
-- truth idempotently so databases created from a pre-tenant live SQLite schema
-- (src/lib/customer-finder/db.ts, where suppressions has NO tenant column yet)
-- converge to the same shape WITHOUT editing 001-003 (forbidden):
--
--   1. ADD COLUMN IF NOT EXISTS tenant_id TEXT  (no-op on fresh 002 databases)
--   2. Backfill explicit 'local-default' where NULL (never a silent
--      cross-tenant merge; matches the provider DEFAULT_TENANT_ID and the 002
--      convention). No-op on fresh databases (column is NOT NULL there).
--   3. SET NOT NULL (no-op once no NULLs remain; safe to re-run).
--   4. CREATE INDEX IF NOT EXISTS idx_customer_finder_suppressions_tenant
--      (same name as 002; no-op on fresh databases).
--   5. RLS re-assertion in the exact 003 style (ENABLE + FORCE + DROP POLICY
--      IF EXISTS + CREATE POLICY ... USING/WITH CHECK on app.tenant_id).
--      No follow-up or 003 regeneration is needed: the policy is fully
--      specified here and is byte-identical in effect to 003's.
--
-- Backfill behavior: pre-tenant local suppression rows land on the explicit,
-- documented 'local-default' tenant and stay valid. 'local-default' must never
-- appear in beta; the runbook's beta checks fail if it does. The per-tenant
-- UNIQUE conversion for contact_fingerprint lives in 004 (this file only
-- ensures the column/index/RLS the 004 constraint depends on).
--
-- Re-runnable-safe per the src/lib/db/migrate.ts runner conventions
-- (ordered, checksummed, no DOWN migrations; beta rollback is PITR).

-- ── tenant column + backfill (no-op on fresh 002 databases) ────────────────
ALTER TABLE customer_finder_suppressions ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE customer_finder_suppressions SET tenant_id = 'local-default' WHERE tenant_id IS NULL;
ALTER TABLE customer_finder_suppressions ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_finder_suppressions_tenant
  ON customer_finder_suppressions(tenant_id);

-- ── RLS re-assertion (003-style; fully specified here, no follow-up needed) ──
ALTER TABLE customer_finder_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_finder_suppressions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customer_finder_suppressions_tenant_isolation ON customer_finder_suppressions;
CREATE POLICY customer_finder_suppressions_tenant_isolation ON customer_finder_suppressions
  FOR ALL TO PUBLIC
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
