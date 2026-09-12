-- 001_tenants_and_bookkeeping.sql
-- w1-postgres-rls-migrate: tenant registry + migration bookkeeping.
--
-- Tenant audit (step 1 of this parcel): NONE of the 13 src/lib/*/db.ts modules
-- carry tenant scoping today — every table listed in 002 lacks tenant_id.
-- This file anchors the tenant model; 002 adds tenant_id to all data tables
-- with an explicit backfill to 'local-default' (never a silent cross-tenant
-- merge); 003 enforces isolation with RLS.
--
-- Columns mirror contracts/BetaTenant.json (tenantId, displayName,
-- betaStatus, public_safe, createdAtUtc). No seed rows are inserted here:
-- tenant onboarding is an operator action documented in the runbook.
-- schema_migrations is infrastructure bookkeeping: intentionally NOT
-- tenant-scoped and NOT covered by RLS (owner-only; see runbook GRANTs).

CREATE TABLE IF NOT EXISTS tenants (
  tenant_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  beta_status TEXT NOT NULL,
  public_safe INTEGER NOT NULL DEFAULT 0,
  created_at_utc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
