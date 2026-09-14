-- 007_ledger-entries.sql
-- k2-cortex-mirror (S11): local-first receipt mirror with hash chain + epoch
-- anchoring + proof-bundle composition. PostgreSQL mirror of the SQLite DDL
-- in src/lib/keon/db.ts (transcribed 1:1 with one addition: tenant_id
-- TEXT NOT NULL right after the primary-key column, per the 002
-- conventions; fresh tables declare tenant_id NOT NULL with NO default so
-- future writes must supply an explicit tenant, fail-closed).
--
-- Contract: contracts/LedgerEntry.json. entry_hash is the content-addressed
-- PRIMARY KEY; seq is UNIQUE per tenant (UNIQUE(tenant_id, seq)) so each
-- tenant owns a monotonic chain from genesis seq 0. epoch_ref stays NULL
-- until closeEpoch() anchors the entry (excluded from entryHash so anchoring
-- never rehashes history). decided_at_utc is the governed effect time
-- (contract timestamp, hashed); recorded_at_utc rides alongside (never
-- hashed — no wall-clock inside hashed bytes). ledger_epochs rows are
-- insert-only (append-only; corrections = new entries, never edits).
--
-- RLS attach point (S11-live step — NO policy invented here): when the beta
-- PG path wires this table, attach the 003-style tenant-isolation pattern:
--   ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE ledger_entries FORCE ROW LEVEL SECURITY;
--   CREATE POLICY ledger_entries_tenant_isolation ON ledger_entries
--     FOR ALL TO PUBLIC
--     USING (tenant_id = current_setting('app.tenant_id', true))
--     WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
-- (and the same for ledger_epochs), following db/migrations/003_rls-policies.sql.
-- Until that S11-live step lands, writes flow through the local SQLite mirror
-- only; no live Cortex calls happen in this parcel.
--
-- Re-runnable-safe per the src/lib/db/migrate.ts runner conventions
-- (ordered, checksummed, no DOWN migrations; beta rollback is PITR).

CREATE TABLE IF NOT EXISTS ledger_entries (
  entry_hash TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  prev_hash TEXT NOT NULL,
  receipt_ref TEXT NOT NULL,
  receipt_class TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  epoch_ref TEXT,
  decided_at_utc TEXT NOT NULL,
  recorded_at_utc TEXT NOT NULL,
  UNIQUE(tenant_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_tenant_seq
  ON ledger_entries(tenant_id, seq);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_receipt_ref
  ON ledger_entries(receipt_ref);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_correlation
  ON ledger_entries(correlation_id);

CREATE TABLE IF NOT EXISTS ledger_epochs (
  epoch_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  root_hash TEXT NOT NULL UNIQUE,
  start_seq INTEGER NOT NULL,
  end_seq INTEGER NOT NULL,
  entry_count INTEGER NOT NULL,
  closed_at_utc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_epochs_tenant
  ON ledger_epochs(tenant_id);
