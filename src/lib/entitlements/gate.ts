/**
 * w2-billing-wire — entitlement gating (beta flag only).
 *
 * `requireEntitlement(tenantId, feature)` is the single decision point that
 * wires Entitlement state to feature gates. GateResult-mirrored outcomes:
 * `{ allowed: true }` on grant, or `{ allowed: false, denialCode,
 * denialMessage, failureStage: "decision" }` on deny — the same denial
 * vocabulary shape as contracts/GateResult.json and the session tenant guard.
 *
 * Beta store (deliberate, do not relitigate in this parcel): a static
 * roster-backed in-memory store seeded from
 * tests/contracts/fixtures/entitlements.json (tenant-keon pilot/active with
 * all three features; tenant-biostack pilot/lapsed). The two MUST be kept in
 * sync manually until the store moves to a real table.
 *
 * Follow-up (h-entitlement-store): DB-backed entitlement store (entitlements
 * table + RLS + migration) so webhook ingest survives restarts and works
 * across instances. This module's read API (`getEntitlement` /
 * `requireEntitlement`) is the seam the DB store will implement.
 *
 * Active/lapsed semantics (per docs/marketops/pricing-packaging.md):
 * - `active` — every listed `features` entry is granted for the tenant.
 * - `lapsed` / `cancelled` — ALL features gate OFF (deny with receipt).
 * - unknown tenant or empty input — deny fail-closed (never grant).
 *
 * No charge path, no Stripe SDK, no network calls. Enforcement only.
 */

import type { Entitlement, EntitlementStatus } from "@/lib/marketops/entities";

/** Feature vocabulary — MUST stay within the fixture vocabulary. */
export const ENTITLEMENT_FEATURES = [
  "claim-review",
  "approval-workflow",
  "proofpack-export",
] as const;

export type EntitlementDenialCode = "ENTITLEMENT_INACTIVE" | "FEATURE_NOT_ENTITLED";

export interface EntitlementGrant {
  allowed: true;
  tenantId: string;
  feature: string;
  entitlement: Entitlement;
}

export interface EntitlementDenial {
  allowed: false;
  denialCode: EntitlementDenialCode;
  denialMessage: string;
  failureStage: "decision";
  tenantId: string | null;
  feature: string;
}

export type EntitlementDecision = EntitlementGrant | EntitlementDenial;

// ─────────────────────────────────────────────────────────────────────────────
// Beta roster-backed store (static seed mirrors
// tests/contracts/fixtures/entitlements.json — keep in sync manually).
// ─────────────────────────────────────────────────────────────────────────────

const ENTITLEMENT_SEED: readonly Entitlement[] = [
  {
    tenantId: "tenant-keon",
    plan: "pilot",
    features: ["claim-review", "approval-workflow", "proofpack-export"],
    status: "active",
    expiresAtUtc: "2026-12-31T23:59:59Z",
    updatedAtUtc: "2026-09-01T09:00:00Z",
  },
  {
    tenantId: "tenant-biostack",
    plan: "pilot",
    features: ["claim-review", "approval-workflow"],
    status: "lapsed",
    expiresAtUtc: "2026-09-01T00:00:00Z",
    updatedAtUtc: "2026-09-02T09:00:00Z",
  },
];

function seedStore(): Map<string, Entitlement> {
  return new Map(ENTITLEMENT_SEED.map((entry) => [entry.tenantId, { ...entry }]));
}

/** In-memory beta store. Webhook ingest mutates this; restarts reseed it. */
const entitlementStore: Map<string, Entitlement> = seedStore();

function copyEntitlement(entry: Entitlement): Entitlement {
  return { ...entry, features: [...entry.features] };
}

/** Load the tenant's Entitlement (defensive copy) or null when unknown. */
export function getEntitlement(tenantId: string): Entitlement | null {
  const key = (tenantId ?? "").trim();
  if (!key) return null;
  const entry = entitlementStore.get(key);
  return entry ? copyEntitlement(entry) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gate decision
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load the tenant's Entitlement and decide `feature`. Pure read (no throws
 * for untrusted input): unknown/empty tenant => ENTITLEMENT_INACTIVE;
 * non-active status (lapsed/cancelled) => ENTITLEMENT_INACTIVE even when the
 * feature is listed; active but unlisted/empty feature => FEATURE_NOT_ENTITLED.
 */
export function requireEntitlement(tenantId: string, feature: string): EntitlementDecision {
  const tenantKey = (tenantId ?? "").trim();
  const featureKey = (feature ?? "").trim();

  if (!tenantKey) {
    return {
      allowed: false,
      denialCode: "ENTITLEMENT_INACTIVE",
      denialMessage: "Entitlement denied: no tenant id supplied (fail-closed).",
      failureStage: "decision",
      tenantId: null,
      feature: featureKey,
    };
  }

  const entitlement = entitlementStore.get(tenantKey);
  if (!entitlement) {
    return {
      allowed: false,
      denialCode: "ENTITLEMENT_INACTIVE",
      denialMessage: `Entitlement denied: tenant ${tenantKey} has no entitlement (fail-closed).`,
      failureStage: "decision",
      tenantId: tenantKey,
      feature: featureKey,
    };
  }

  if (entitlement.status !== "active") {
    const reason =
      entitlement.status === "lapsed"
        ? "entitlement is lapsed (payment failure or expired term)"
        : entitlement.status === "cancelled"
          ? "entitlement is cancelled (subscription deleted or pilot terminated)"
          : `entitlement status is ${entitlement.status}`;
    return {
      allowed: false,
      denialCode: "ENTITLEMENT_INACTIVE",
      denialMessage: `Entitlement denied: ${reason}; all features gate off for tenant ${tenantKey}.`,
      failureStage: "decision",
      tenantId: tenantKey,
      feature: featureKey,
    };
  }

  if (!featureKey || !entitlement.features.includes(featureKey)) {
    return {
      allowed: false,
      denialCode: "FEATURE_NOT_ENTITLED",
      denialMessage: `Entitlement denied: feature ${featureKey || "(empty)"} is not entitled for tenant ${tenantKey}.`,
      failureStage: "decision",
      tenantId: tenantKey,
      feature: featureKey,
    };
  }

  return {
    allowed: true,
    tenantId: tenantKey,
    feature: featureKey,
    entitlement: copyEntitlement(entitlement),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Webhook apply path (mutates the beta in-memory store)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply a webhook-derived entitlement outcome to the beta store. Throws
 * fail-closed for unknown tenants (no silent provisioning — onboarding is an
 * explicit operator/product decision, reported as an open item in the PR).
 * Returns a defensive copy of the updated entitlement.
 */
export function applyEntitlementOutcome(
  tenantId: string,
  status: EntitlementStatus,
  opts?: { nowUtc?: string },
): Entitlement {
  const tenantKey = (tenantId ?? "").trim();
  const current = tenantKey ? entitlementStore.get(tenantKey) : undefined;
  if (!current) {
    throw new Error(
      `Cannot apply entitlement outcome: tenant ${tenantKey || "(empty)"} has no entitlement (fail-closed: refusing to provision).`,
    );
  }
  const next: Entitlement = {
    ...current,
    features: [...current.features],
    status,
    updatedAtUtc: opts?.nowUtc ?? new Date().toISOString(),
  };
  entitlementStore.set(tenantKey, next);
  return copyEntitlement(next);
}

/** Test-only reset: restore the beta store to the fixture seed. */
export function __testOnlyResetEntitlements(): void {
  entitlementStore.clear();
  for (const [key, value] of seedStore()) entitlementStore.set(key, value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Throwing enforcement for server actions / routes (TenantScopeError pattern)
// ─────────────────────────────────────────────────────────────────────────────

/** Structured error thrown by `enforceEntitlement` on denial (HTTP 403). */
export class EntitlementGateError extends Error {
  readonly httpStatus = 403 as const;
  readonly denialCode: EntitlementDenialCode;
  readonly denialMessage: string;
  readonly failureStage = "decision" as const;
  readonly tenantId: string | null;
  readonly feature: string;
  readonly action: string;

  constructor(denial: EntitlementDenial, action: string) {
    super(denial.denialMessage);
    this.name = "EntitlementGateError";
    this.denialCode = denial.denialCode;
    this.denialMessage = denial.denialMessage;
    this.tenantId = denial.tenantId;
    this.feature = denial.feature;
    this.action = action;
  }

  toResponseBody(): {
    error: string;
    denialCode: EntitlementDenialCode;
    denialMessage: string;
    failureStage: "decision";
  } {
    return {
      error: "Forbidden",
      denialCode: this.denialCode,
      denialMessage: this.denialMessage,
      failureStage: this.failureStage,
    };
  }
}

/**
 * Surgical chokepoint helper: enforce `feature` for `tenantId`, throwing
 * EntitlementGateError (403, GateResult-mirrored) on denial. Returns the
 * granting entitlement on allow.
 */
export function enforceEntitlement(tenantId: string, feature: string, action: string): Entitlement {
  const act = action && action.trim().length > 0 ? action : "access";
  const decision = requireEntitlement(tenantId, feature);
  if (!decision.allowed) throw new EntitlementGateError(decision, act);
  return decision.entitlement;
}
