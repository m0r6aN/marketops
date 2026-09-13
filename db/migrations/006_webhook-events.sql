-- 006_webhook-events.sql
-- w2-billing-wire: billing webhook idempotency log (test-mode ingest).
--
-- Ruling (already made, do not relitigate): Stripe test-mode only, manual
-- invoicing; no keys in repo, no charge path, no Stripe SDK. This table
-- records every ingested BillingWebhook event keyed by its globally unique
-- `eventId` so replays never double-apply an entitlement transition (see
-- contracts/BillingWebhook.json and docs/marketops/pricing-packaging.md §3).
--
-- Scope notes (deliberate per-parcel choices, documented here):
-- * Dedupe key is GLOBAL (event_id PRIMARY KEY), not per-tenant: a replayed
--   `customer.subscription.deleted` arriving after a newer
--   `checkout.session.completed` must be visible as already-seen regardless of
--   which tenant scope the reader holds. Replay-ordering rules (stale `deleted`
--   must not regress a re-activated tenant) are an open product decision
--   (pricing doc §5.4); this table stores `created` + `received_at_utc` so the
--   rule has the timestamps it needs when it lands.
-- * NO RLS on this table — it is infrastructure bookkeeping like
--   schema_migrations (see 001: owner-only, intentionally NOT tenant-scoped
--   and NOT covered by RLS). Tenant isolation for entitlements themselves is
--   owned by the DB-backed entitlement store follow-up (h-entitlement-store);
--   the beta store is in-memory (see src/lib/entitlements/gate.ts).
-- * Entitlement state is NOT stored here — only the event log
--   (event_id/type/tenant_id/created/received_at_utc/applied_outcome). The
--   durable entitlements table is the h-entitlement-store follow-up.
--
-- Re-runnable-safe per the src/lib/db/migrate.ts runner conventions
-- (ordered, checksummed, no DOWN migrations; beta rollback is PITR).

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  created TEXT NOT NULL,
  received_at_utc TEXT NOT NULL,
  applied_outcome TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_tenant
  ON billing_webhook_events(tenant_id);
