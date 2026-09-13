/**
 * w2-billing-wire — test-mode billing webhook ingest (no charge, no Stripe
 * SDK, no network calls to Stripe).
 *
 * - Shape validation hand-mirrors contracts/BillingWebhook.json (no new
 *   dependencies: ajv stays a test-only transitive dep, so src hand-rolls the
 *   same required-fields / enum / no-unknown-top-level-keys checks).
 * - Event → entitlement-outcome mapping (per
 *   docs/marketops/pricing-packaging.md §4):
 *     checkout.session.completed      → active
 *     customer.subscription.updated   → active
 *     customer.subscription.deleted   → cancelled
 *     invoice.payment_failed          → lapsed
 * - Idempotency: `eventId` is the global dedupe key. The SQLite table
 *   `billing_webhook_events` (see db/migrations/006_webhook-events.sql for the
 *   PG DDL; `ensureWebhookEventsTable` below is the SQLite-compatible
 *   equivalent per the src/lib star-db.ts CREATE TABLE IF NOT EXISTS
 *   convention) records every applied event. Replays return deduped:true and
 *   never re-apply. The INSERT runs inside a try/catch on the primary-key
 *   constraint so a concurrent double-delivery still applies exactly once.
 * - Test-mode only: ingest requires an explicit test-mode marker
 *   (`x-marketops-billing-test: test` header at the route; `testMode: true`
 *   here). Anything not test-marked is rejected fail-closed with
 *   LIVE_WEBHOOK_REJECTED — live signature verification is a hardening
 *   follow-up (h-webhook-signature). Signature crypto is deliberately NOT
 *   half-implemented here and unsigned live events are never accepted
 *   silently.
 */

import { db as defaultDb } from "@/lib/db/provider";
import type { BillingWebhookEvent, BillingWebhookEventType, EntitlementStatus } from "@/lib/marketops/entities";

import { applyEntitlementOutcome } from "./gate";

/** Header carrying the test-mode marker (route level). */
export const BILLING_TEST_MODE_HEADER = "x-marketops-billing-test";

/** Only this exact header value marks a request as test-mode. */
export const BILLING_TEST_MODE_VALUE = "test";

/** Intended entitlement outcome per Stripe event type (pricing doc §4). */
export const BILLING_EVENT_OUTCOME: Record<BillingWebhookEventType, EntitlementStatus> = {
  "checkout.session.completed": "active",
  "customer.subscription.updated": "active",
  "customer.subscription.deleted": "cancelled",
  "invoice.payment_failed": "lapsed",
};

const BILLING_EVENT_TYPES = Object.keys(BILLING_EVENT_OUTCOME) as BillingWebhookEventType[];

/** Minimal structural surface needed from better-sqlite3 (injectable for tests). */
export interface WebhookDedupeDb {
  exec(sql: string): unknown;
  prepare(sql: string): {
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): { changes: number | bigint };
  };
}

export function ensureWebhookEventsTable(target: WebhookDedupeDb = defaultDb): void {
  target.exec(`
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
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// Shape validation (mirrors contracts/BillingWebhook.json)
// ─────────────────────────────────────────────────────────────────────────────

const WEBHOOK_TOP_LEVEL_KEYS = ["eventId", "type", "created", "tenantId", "data"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoDateTime(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return false;
  // Require an explicit UTC designator or offset (contract: UTC ISO-8601).
  return /[zZ]|[+-]\d{2}:?\d{2}$/.test(value.trim());
}

/**
 * Validate an unknown POST body against the BillingWebhook contract shape.
 * Unknown event types are rejected (never applied).
 */
export function validateBillingWebhookBody(
  body: unknown,
): { ok: true; event: BillingWebhookEvent } | { ok: false; error: string } {
  if (!isRecord(body)) return { ok: false, error: "webhook body must be a JSON object" };
  for (const key of Object.keys(body)) {
    if (!(WEBHOOK_TOP_LEVEL_KEYS as readonly string[]).includes(key)) {
      return { ok: false, error: `webhook body has unknown property ${JSON.stringify(key)}` };
    }
  }
  const { eventId, type, created, tenantId, data } = body;
  if (typeof eventId !== "string" || eventId.length === 0) {
    return { ok: false, error: "webhook eventId must be a non-empty string" };
  }
  if (typeof type !== "string" || !BILLING_EVENT_TYPES.includes(type as BillingWebhookEventType)) {
    return { ok: false, error: `webhook type must be one of ${BILLING_EVENT_TYPES.join(", ")}` };
  }
  if (!isIsoDateTime(created)) {
    return { ok: false, error: "webhook created must be an ISO-8601 UTC timestamp" };
  }
  if (typeof tenantId !== "string" || tenantId.length === 0) {
    return { ok: false, error: "webhook tenantId must be a non-empty string" };
  }
  if (!isRecord(data)) {
    return { ok: false, error: "webhook data must be an object" };
  }
  return {
    ok: true,
    event: {
      eventId,
      type: type as BillingWebhookEventType,
      created,
      tenantId,
      data: data as Record<string, unknown>,
    },
  };
}

/** True only when the explicit test-mode marker is present (fail-closed). */
export function isTestMarked(
  headers: Headers | Record<string, string | null | undefined> | undefined,
): boolean {
  if (!headers) return false;
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(BILLING_TEST_MODE_HEADER) === BILLING_TEST_MODE_VALUE;
  }
  const record = headers as Record<string, string | null | undefined>;
  for (const [key, value] of Object.entries(record)) {
    if (key.toLowerCase() === BILLING_TEST_MODE_HEADER && value === BILLING_TEST_MODE_VALUE) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ingest
// ─────────────────────────────────────────────────────────────────────────────

export type BillingIngestResult =
  | { ok: true; deduped: false; eventId: string; tenantId: string; outcome: EntitlementStatus }
  | { ok: true; deduped: true; eventId: string; tenantId: string }
  | {
      ok: false;
      httpStatus: 400 | 403 | 422;
      denialCode: "LIVE_WEBHOOK_REJECTED" | "INVALID_WEBHOOK_SHAPE" | "UNKNOWN_TENANT";
      denialMessage: string;
      failureStage: "decision";
    };

function isPrimaryKeyConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  if (code === "SQLITE_CONSTRAINT_PRIMARYKEY") return true;
  const message = error instanceof Error ? error.message : "";
  return message.includes("UNIQUE constraint failed: billing_webhook_events.event_id");
}

/**
 * Ingest one webhook body. Fail-closed order: test-mode marker → contract
 * shape → idempotent dedupe on eventId → single entitlement apply.
 */
export function ingestBillingWebhookEvent(
  body: unknown,
  opts: { testMode: boolean; nowUtc?: string; db?: WebhookDedupeDb },
): BillingIngestResult {
  if (!opts.testMode) {
    return {
      ok: false,
      httpStatus: 403,
      denialCode: "LIVE_WEBHOOK_REJECTED",
      denialMessage:
        "Billing webhook denied: missing test-mode marker. Live signature verification (h-webhook-signature) is not implemented; unsigned live events are never accepted.",
      failureStage: "decision",
    };
  }

  const shaped = validateBillingWebhookBody(body);
  if (!shaped.ok) {
    return {
      ok: false,
      httpStatus: 400,
      denialCode: "INVALID_WEBHOOK_SHAPE",
      denialMessage: `Billing webhook denied: ${shaped.error}.`,
      failureStage: "decision",
    };
  }
  const event = shaped.event;
  const outcome = BILLING_EVENT_OUTCOME[event.type];
  const target = opts.db ?? defaultDb;
  ensureWebhookEventsTable(target);

  const seen = target
    .prepare(`SELECT event_id AS eventId FROM billing_webhook_events WHERE event_id = ?`)
    .get(event.eventId) as { eventId: string } | undefined;
  if (seen) {
    return { ok: true, deduped: true, eventId: event.eventId, tenantId: event.tenantId };
  }

  const receivedAtUtc = opts.nowUtc ?? new Date().toISOString();
  try {
    target
      .prepare(
        `INSERT INTO billing_webhook_events (event_id, type, tenant_id, created, received_at_utc, applied_outcome)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(event.eventId, event.type, event.tenantId, event.created, receivedAtUtc, outcome);
  } catch (error) {
    // Lost a delivery race: the other delivery owns the apply; this one replays.
    if (isPrimaryKeyConflict(error)) {
      return { ok: true, deduped: true, eventId: event.eventId, tenantId: event.tenantId };
    }
    throw error;
  }

  try {
    applyEntitlementOutcome(event.tenantId, outcome, { nowUtc: receivedAtUtc });
  } catch (error) {
    // Fail-closed: no silent provisioning. The eventId row stays recorded so
    // the unknown-tenant event is never retried into existence; operators
    // resolve the tenant mapping and re-ingest under a new eventId.
    return {
      ok: false,
      httpStatus: 422,
      denialCode: "UNKNOWN_TENANT",
      denialMessage: `Billing webhook not applied: ${error instanceof Error ? error.message : "unknown tenant"}`,
      failureStage: "decision",
    };
  }

  return { ok: true, deduped: false, eventId: event.eventId, tenantId: event.tenantId, outcome };
}
