import Ajv from "ajv";
import { describe, expect, test } from "vitest";

import type { BillingWebhookEvent } from "@/lib/marketops/entities";
import billingWebhookSchema from "../../contracts/BillingWebhook.json";
import billingWebhooks from "./fixtures/billing-webhooks.json";

// ajv is a transitive dependency (via eslint toolchain); used here for
// fixture-satisfies-contract tests only. No package.json change, no zod.
// Spec/contract only: no Stripe SDK, no network calls, no charge paths.
const ajv = new Ajv({ allErrors: true });

function validate(schema: object, data: unknown): boolean {
  return ajv.validate(schema, data) as boolean;
}

// Intended webhook -> entitlement outcome mapping (spec reference;
// enforcement lands in w2-billing-wire). Consistent with Entitlement
// statuses: active grants features, lapsed/cancelled gate them off.
const EXPECTED_OUTCOME: Record<BillingWebhookEvent["type"], string> = {
  "checkout.session.completed": "active",
  "customer.subscription.updated": "active",
  "customer.subscription.deleted": "cancelled",
  "invoice.payment_failed": "lapsed",
};

describe("BillingWebhook contract", () => {
  test("one valid fixture per event type", () => {
    const events = billingWebhooks as BillingWebhookEvent[];
    const types = new Set(events.map((e) => e.type));
    expect(types).toEqual(
      new Set([
        "checkout.session.completed",
        "customer.subscription.updated",
        "customer.subscription.deleted",
        "invoice.payment_failed",
      ])
    );
    for (const event of events) {
      expect(validate(billingWebhookSchema, event)).toBe(true);
    }
  });

  test("fixtures map to active/lapsed outcomes consistent with Entitlement statuses", () => {
    const events = billingWebhooks as BillingWebhookEvent[];
    for (const event of events) {
      expect(EXPECTED_OUTCOME[event.type]).toMatch(/^(active|lapsed|cancelled)$/);
    }
    // Recovery path: failed invoice lapses, later update re-activates.
    const byType = Object.fromEntries(events.map((e) => [e.type, e]));
    expect(byType["invoice.payment_failed"].tenantId).toBe("tenant-biostack");
    expect(EXPECTED_OUTCOME[byType["invoice.payment_failed"].type]).toBe("lapsed");
    expect(EXPECTED_OUTCOME[byType["customer.subscription.updated"].type]).toBe("active");
    // Termination path: deleted means cancelled, never silently active.
    expect(EXPECTED_OUTCOME[byType["customer.subscription.deleted"].type]).toBe("cancelled");
  });

  test("eventIds are unique (idempotency key; replay must not double-apply)", () => {
    const events = billingWebhooks as BillingWebhookEvent[];
    const ids = new Set(events.map((e) => e.eventId));
    expect(ids.size).toBe(events.length);
  });

  test("rejects unknown type", () => {
    const base = (billingWebhooks as BillingWebhookEvent[])[0];
    expect(
      validate(billingWebhookSchema, { ...base, type: "charge.refunded" })
    ).toBe(false);
  });

  test("rejects missing eventId", () => {
    const base = { ...(billingWebhooks as BillingWebhookEvent[])[0] } as Record<
      string,
      unknown
    >;
    delete base.eventId;
    expect(validate(billingWebhookSchema, base)).toBe(false);
  });

  test("rejects missing tenantId and non-UTC-timestamp created", () => {
    const base = (billingWebhooks as BillingWebhookEvent[])[0];
    const withoutTenant: Record<string, unknown> = { ...base };
    delete withoutTenant.tenantId;
    expect(validate(billingWebhookSchema, withoutTenant)).toBe(false);
    expect(validate(billingWebhookSchema, { ...base, created: "not-a-timestamp" })).toBe(false);
  });
});
