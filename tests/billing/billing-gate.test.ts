/**
 * w2-billing-wire — billing-gate tests (entitlement gating + test-mode
 * webhook ingest). No Stripe SDK, no network calls, no charge paths.
 *
 * - Gate: entitled ok / lapsed→gated with code / cancelled→gated /
 *   unknown feature→gated / unknown tenant→gated (fail-closed).
 * - Webhook ingest (isolated :memory: dedupe db unless noted): replay of the
 *   same eventId applies exactly once; bad-shape bodies rejected; non-
 *   test-marked ingest rejected fail-closed.
 * - Route level: POST without the test-mode header is rejected before any db
 *   write; the happy path writes exactly one dedupe row (cleaned up).
 * - Migration 006 is present, ordered, and carries the global event_id
 *   primary key (no RLS by documented bookkeeping choice).
 */
import { afterEach, describe, expect, test } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

import { POST } from "@/app/api/billing/webhook/route";
import { db as providerDb } from "@/lib/db/provider";
import { getMigrationsDir, listMigrationFiles } from "@/lib/db/migrate";
import {
  EntitlementGateError,
  __testOnlyResetEntitlements,
  enforceEntitlement,
  getEntitlement,
  requireEntitlement,
} from "@/lib/entitlements/gate";
import {
  BILLING_EVENT_OUTCOME,
  BILLING_TEST_MODE_HEADER,
  BILLING_TEST_MODE_VALUE,
  ensureWebhookEventsTable,
  ingestBillingWebhookEvent,
  isTestMarked,
  validateBillingWebhookBody,
  type WebhookDedupeDb,
} from "@/lib/entitlements/webhook";

const KEON = "tenant-keon";
const BIOSTACK = "tenant-biostack";

afterEach(() => {
  __testOnlyResetEntitlements();
});

function memoryDb(): WebhookDedupeDb {
  const mem = new Database(":memory:");
  return mem as unknown as WebhookDedupeDb;
}

let eventSeq = 0;
function nextEventId(prefix: string): string {
  eventSeq += 1;
  return `${prefix}_${String(eventSeq).padStart(3, "0")}`;
}

function checkoutCompleted(tenantId: string, eventId: string) {
  return {
    eventId,
    type: "checkout.session.completed",
    created: "2026-09-10T10:00:00Z",
    tenantId,
    data: { mode: "subscription", paymentStatus: "paid" },
  };
}

// ── gate decisions ───────────────────────────────────────────────────────────

describe("requireEntitlement gate", () => {
  test("active tenant with the feature is allowed", () => {
    const decision = requireEntitlement(KEON, "proofpack-export");
    expect(decision.allowed).toBe(true);
    if (!decision.allowed) throw new Error("unreachable");
    expect(decision.tenantId).toBe(KEON);
    expect(decision.entitlement.status).toBe("active");
  });

  test("lapsed tenant is gated with ENTITLEMENT_INACTIVE (even for listed features)", () => {
    const decision = requireEntitlement(BIOSTACK, "claim-review");
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error("unreachable");
    expect(decision.denialCode).toBe("ENTITLEMENT_INACTIVE");
    expect(decision.failureStage).toBe("decision");
    expect(decision.denialMessage).toMatch(/lapsed/);
  });

  test("cancelled tenant is gated with ENTITLEMENT_INACTIVE", () => {
    const first = ingestBillingWebhookEvent(
      {
        eventId: nextEventId("evt_billing_gate_cancel"),
        type: "customer.subscription.deleted",
        created: "2026-09-10T11:00:00Z",
        tenantId: KEON,
        data: { status: "canceled" },
      },
      { testMode: true, db: memoryDb() },
    );
    expect(first.ok).toBe(true);
    if (!first.ok || first.deduped) throw new Error("unreachable");
    expect(first.outcome).toBe("cancelled");
    const decision = requireEntitlement(KEON, "claim-review");
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error("unreachable");
    expect(decision.denialCode).toBe("ENTITLEMENT_INACTIVE");
    expect(decision.failureStage).toBe("decision");
    expect(decision.denialMessage).toMatch(/cancelled/);
  });

  test("active tenant with an unknown feature is gated with FEATURE_NOT_ENTITLED", () => {
    const decision = requireEntitlement(KEON, "time-travel");
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error("unreachable");
    expect(decision.denialCode).toBe("FEATURE_NOT_ENTITLED");
    expect(decision.failureStage).toBe("decision");
  });

  test("unknown and empty tenants deny fail-closed", () => {
    for (const tenantId of ["tenant-ghost", "", "   "]) {
      const decision = requireEntitlement(tenantId, "claim-review");
      expect(decision.allowed).toBe(false);
      if (decision.allowed) throw new Error("unreachable");
      expect(decision.denialCode).toBe("ENTITLEMENT_INACTIVE");
      expect(decision.failureStage).toBe("decision");
    }
    expect(getEntitlement("tenant-ghost")).toBeNull();
  });

  test("enforceEntitlement throws a 403 GateResult-mirrored error on denial", () => {
    expect(enforceEntitlement(KEON, "claim-review", "probe").status).toBe("active");
    try {
      enforceEntitlement(BIOSTACK, "claim-review", "probe");
      throw new Error("unreachable: lapsed tenant must be denied");
    } catch (error) {
      expect(error).toBeInstanceOf(EntitlementGateError);
      const gate = error as EntitlementGateError;
      expect(gate.httpStatus).toBe(403);
      expect(gate.toResponseBody()).toEqual({
        error: "Forbidden",
        denialCode: "ENTITLEMENT_INACTIVE",
        denialMessage: gate.denialMessage,
        failureStage: "decision",
      });
    }
  });
});

// ── webhook ingest ───────────────────────────────────────────────────────────

describe("billing webhook ingest", () => {
  test("event→outcome mapping matches the pricing-doc contract table", () => {
    expect(BILLING_EVENT_OUTCOME).toEqual({
      "checkout.session.completed": "active",
      "customer.subscription.updated": "active",
      "customer.subscription.deleted": "cancelled",
      "invoice.payment_failed": "lapsed",
    });
  });

  test("replay of the same eventId applies exactly once", () => {
    const db = memoryDb();
    const body = checkoutCompleted(KEON, nextEventId("evt_billing_gate_replay"));
    const first = ingestBillingWebhookEvent(body, { testMode: true, db });
    expect(first).toMatchObject({ ok: true, deduped: false });
    if (!first.ok || first.deduped) throw new Error("unreachable");
    expect(first.outcome).toBe("active");

    const second = ingestBillingWebhookEvent(body, { testMode: true, db });
    expect(second).toEqual({ ok: true, deduped: true, eventId: body.eventId, tenantId: KEON });

    const rows = (db as unknown as Database.Database)
      .prepare(`SELECT COUNT(*) AS n FROM billing_webhook_events WHERE event_id = ?`)
      .get(body.eventId) as { n: number };
    expect(rows.n).toBe(1);
  });

  test("payment_failed lapses the tenant (recovery path stays applicable)", () => {
    const db = memoryDb();
    const failed = ingestBillingWebhookEvent(
      {
        eventId: nextEventId("evt_billing_gate_failed"),
        type: "invoice.payment_failed",
        created: "2026-09-10T12:00:00Z",
        tenantId: KEON,
        data: { billingReason: "subscription_cycle", attemptCount: 1 },
      },
      { testMode: true, db },
    );
    expect(failed).toMatchObject({ ok: true, deduped: false });
    expect(requireEntitlement(KEON, "claim-review").allowed).toBe(false);

    const recovered = ingestBillingWebhookEvent(checkoutCompleted(KEON, nextEventId("evt_billing_gate_recover")), {
      testMode: true,
      db,
    });
    expect(recovered).toMatchObject({ ok: true, deduped: false, outcome: "active" });
    expect(requireEntitlement(KEON, "claim-review").allowed).toBe(true);
  });

  test("bad-shape bodies are rejected without a db write", () => {
    const db = memoryDb();
    const base = checkoutCompleted(KEON, nextEventId("evt_billing_gate_shape"));
    const badBodies: unknown[] = [
      { ...base, eventId: undefined },
      { ...base, type: "charge.refunded" },
      { ...base, created: "not-a-timestamp" },
      { ...base, tenantId: "" },
      { ...base, extra: "nope" },
      { ...base, data: null },
      "not-an-object",
    ];
    for (const body of badBodies) {
      expect(validateBillingWebhookBody(body).ok).toBe(false);
      const result = ingestBillingWebhookEvent(body, { testMode: true, db });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("unreachable");
      expect(result.httpStatus).toBe(400);
      expect(result.denialCode).toBe("INVALID_WEBHOOK_SHAPE");
      expect(result.failureStage).toBe("decision");
    }
    ensureWebhookEventsTable(db);
    const rows = (db as unknown as Database.Database)
      .prepare(`SELECT COUNT(*) AS n FROM billing_webhook_events`)
      .get() as { n: number };
    expect(rows.n).toBe(0);
  });

  test("non-test-marked ingest is rejected fail-closed (no silent live accept)", () => {
    expect(isTestMarked(undefined)).toBe(false);
    expect(isTestMarked({})).toBe(false);
    expect(isTestMarked({ [BILLING_TEST_MODE_HEADER]: "1" })).toBe(false);
    expect(isTestMarked({ [BILLING_TEST_MODE_HEADER]: BILLING_TEST_MODE_VALUE })).toBe(true);
    const headers = new Headers();
    headers.set(BILLING_TEST_MODE_HEADER, BILLING_TEST_MODE_VALUE);
    expect(isTestMarked(headers)).toBe(true);

    const result = ingestBillingWebhookEvent(checkoutCompleted(KEON, nextEventId("evt_billing_gate_live")), {
      testMode: false,
      db: memoryDb(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.httpStatus).toBe(403);
    expect(result.denialCode).toBe("LIVE_WEBHOOK_REJECTED");
    expect(result.failureStage).toBe("decision");
  });

  test("unknown tenant is not provisioned (fail-closed 422)", () => {
    const result = ingestBillingWebhookEvent(checkoutCompleted("tenant-ghost", nextEventId("evt_billing_gate_ghost")), {
      testMode: true,
      db: memoryDb(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.httpStatus).toBe(422);
    expect(result.denialCode).toBe("UNKNOWN_TENANT");
    expect(getEntitlement("tenant-ghost")).toBeNull();
  });
});

// ── route level ──────────────────────────────────────────────────────────────

describe("POST /api/billing/webhook", () => {
  test("missing test-mode marker is rejected before any apply", async () => {
    const response = await POST(
      new Request("http://localhost/api/billing/webhook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(checkoutCompleted(KEON, nextEventId("evt_billing_gate_route_nomark"))),
      }),
    );
    expect(response.status).toBe(403);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload.denialCode).toBe("LIVE_WEBHOOK_REJECTED");
    expect(payload.failureStage).toBe("decision");
  });

  test("malformed JSON is rejected as invalid shape", async () => {
    const response = await POST(
      new Request("http://localhost/api/billing/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [BILLING_TEST_MODE_HEADER]: BILLING_TEST_MODE_VALUE,
        },
        body: "{not-json",
      }),
    );
    expect(response.status).toBe(400);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload.denialCode).toBe("INVALID_WEBHOOK_SHAPE");
  });

  test("test-marked valid event applies once (dedupe row cleaned up)", async () => {
    const eventId = "evt_billing_gate_route_probe_001";
    ensureWebhookEventsTable(providerDb as unknown as WebhookDedupeDb);
    providerDb
      .prepare(`DELETE FROM billing_webhook_events WHERE event_id = ?`)
      .run(eventId);

    const headers = {
      "content-type": "application/json",
      [BILLING_TEST_MODE_HEADER]: BILLING_TEST_MODE_VALUE,
    };
    const first = await POST(
      new Request("http://localhost/api/billing/webhook", {
        method: "POST",
        headers,
        body: JSON.stringify(checkoutCompleted(KEON, eventId)),
      }),
    );
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ ok: true, deduped: false, eventId, outcome: "active" });

    const replay = await POST(
      new Request("http://localhost/api/billing/webhook", {
        method: "POST",
        headers,
        body: JSON.stringify(checkoutCompleted(KEON, eventId)),
      }),
    );
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ ok: true, deduped: true, eventId });

    providerDb.prepare(`DELETE FROM billing_webhook_events WHERE event_id = ?`).run(eventId);
    const remaining = providerDb
      .prepare(`SELECT COUNT(*) AS n FROM billing_webhook_events WHERE event_id = ?`)
      .get(eventId) as { n: number };
    expect(remaining.n).toBe(0);
  });
});

// ── migration 006 static proof ───────────────────────────────────────────────

describe("006 webhook-events migration", () => {
  test("006 exists, is ordered after 005, and keys dedupe globally", () => {
    const files = listMigrationFiles(getMigrationsDir());
    const versions = files.map((file) => file.version);
    expect(versions).toEqual([...versions].sort());
    expect(versions.slice(0, 5)).toEqual(["001", "002", "003", "004", "005"]);
    expect(versions).toContain("006");
    const file006 = files.find((file) => file.version === "006");
    expect(file006?.fileName).toBe("006_webhook-events.sql");
    const sql = fs.readFileSync(path.join(getMigrationsDir(), "006_webhook-events.sql"), "utf8");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS billing_webhook_events");
    expect(sql).toContain("event_id TEXT PRIMARY KEY");
    expect(sql).toContain("idx_billing_webhook_events_tenant");
  });
});
