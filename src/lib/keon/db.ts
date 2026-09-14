// ---------------------------------------------------------------------------
// k2-cortex-mirror — S11 local-first receipt mirror tables (SQLite DDL).
//
// Doctrine (binding, do not relitigate): chain-over-collection (unlinked
// receipts are NOT a ledger); append-only (corrections = new entries).
//
// Conventions: connection comes from @/lib/db/provider (sqlite default, same
// file). This module keeps the ledger DDL only, mirroring the 13-module
// src/lib/*/db.ts pattern (db.exec CREATE TABLE IF NOT EXISTS at import,
// export { db }). The PostgreSQL mirror lives in
// db/migrations/007_ledger-entries.sql (fresh tables, tenant_id NOT NULL, no
// default — future writes must supply an explicit tenant, fail-closed).
//
// Tables:
// - ledger_entries: one hash-chained row per mirrored decision receipt
//   (contract: contracts/LedgerEntry.json). entry_hash is the content-addressed
//   PRIMARY KEY; seq is UNIQUE per tenant (UNIQUE(tenant_id, seq)) so each
//   tenant owns a monotonic chain starting at genesis seq 0 — a global UNIQUE
//   on seq would forbid per-tenant chains and violate tenant isolation.
//   epoch_ref stays NULL until closeEpoch() anchors the entry; it is EXCLUDED
//   from entryHash so anchoring composes additively and never rewrites
//   history. decided_at_utc is the governed effect time (contract timestamp,
//   hashed); recorded_at_utc is local record time kept ALONGSIDE the hash
//   (never hashed — no wall-clock inside hashed bytes).
// - ledger_epochs: append-only epoch anchors. Closing an epoch never rehashes
//   history; rows are insert-only (no UPDATE/DELETE helpers exist here).
//
// No clients, no transport, no network calls. No new dependencies.
// ---------------------------------------------------------------------------

import { db } from "@/lib/db/provider";

db.exec(`
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

  CREATE TABLE IF NOT EXISTS ledger_epochs (
    epoch_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    root_hash TEXT NOT NULL UNIQUE,
    start_seq INTEGER NOT NULL,
    end_seq INTEGER NOT NULL,
    entry_count INTEGER NOT NULL,
    closed_at_utc TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_ledger_entries_tenant_seq
    ON ledger_entries(tenant_id, seq);
  CREATE INDEX IF NOT EXISTS idx_ledger_entries_receipt_ref
    ON ledger_entries(receipt_ref);
  CREATE INDEX IF NOT EXISTS idx_ledger_entries_correlation
    ON ledger_entries(correlation_id);
  CREATE INDEX IF NOT EXISTS idx_ledger_epochs_tenant
    ON ledger_epochs(tenant_id);
`);

export { db };

/**
 * Test/maintenance purge for the local mirror tables. Deletes epoch anchors
 * first (child references by epoch_ref are logical, not FK-enforced), then
 * entries — optionally scoped to one tenant. There is deliberately NO
 * row-level delete helper: production code is append-only; corrections are
 * new entries, never edits.
 */
export function purgeLedgerMirrorData(tenantId?: string): void {
  if (tenantId !== undefined && tenantId.trim().length > 0) {
    db.prepare(`DELETE FROM ledger_epochs WHERE tenant_id = ?`).run(tenantId);
    db.prepare(`DELETE FROM ledger_entries WHERE tenant_id = ?`).run(tenantId);
    return;
  }
  db.prepare(`DELETE FROM ledger_epochs`).run();
  db.prepare(`DELETE FROM ledger_entries`).run();
}
