/**
 * int-b-claim-billing — composed entitlement × claim-gate proof (local).
 * Surfaces S3+S4 | Scenarios int-billing-gate, int-claim-block.
 *
 * Proves the money × trust matrix COMPOSED (not in isolation):
 * - billing positive: keon (active) passes the S3 chokepoints.
 * - billing negative: biostack (lapsed) is gated ENTITLEMENT_INACTIVE at the
 *   same chokepoints; payment_failed flips a tenant pass→gated; replay dedupes.
 * - claim positive: safe content flows through the S4 apply gate.
 * - claim blocked: banned content is refused even for entitled keon
 *   (trust gates do NOT yield to money — asserted explicitly).
 * - claim failure: eval-failure input → needs-review (never silent allow);
 *   apply without approval → APPROVAL_REQUIRED with a readable receipt.
 * - composed: lapsed + banned yields BOTH denials; the entitlement check
 *   leaks no claim details across tenants.
 *
 * Reuses billing-gate + claim-approval patterns; does not duplicate their
 * unit coverage. Test-mode webhook ingest only (memory dedupe db); no Stripe
 * SDK, no network, no charge paths.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import Database from "better-sqlite3";

import { TenantScopeError } from "@/lib/auth/session";
import {
  ENTITLEMENT_FEATURES,
  EntitlementGateError,
  __testOnlyResetEntitlements,
  enforceEntitlement,
  requireEntitlement,
} from "@/lib/entitlements/gate";
import {
  ingestBillingWebhookEvent,
  type WebhookDedupeDb,
} from "@/lib/entitlements/webhook";
import {
  CLAIM_POLICY_VERSION,
  evaluateClaim,
  evaluateClaimDetailed,
} from "@/lib/claims/policy";
import { createEmptyContentVersionInput } from "@/lib/content-workspace/types";
import type {
  ContentClaimFinding,
  ContentVersionInput,
  ContentVersionRecord,
} from "@/lib/content-workspace/types";
import {
  purgeContentWorkspaceData,
} from "@/lib/content-workspace/repository";
import { getInitiativeBySlug } from "@/lib/initiatives/repository";
import type { Initiative } from "@/lib/initiatives/types";
import {
  createPersuasionReview,
  listClaimDecisionReceipts,
  purgePersuasionReviewData,
  recordClaimDecisionReceipt,
  requireRowTenantMatch as requirePersuasionRowTenant,
} from "@/lib/persuasion-review/repository";
import {
  buildPersuasionReview,
  ClaimGateError,
  claimEvidenceRefsForSources,
  decideClaimApply,
  deriveReviewClaimVerdict,
} from "@/lib/persuasion-review/service";

const KEON = "tenant-keon";
const BIOSTACK = "tenant-biostack";
const SLUG = "keon-systems";
const BANNED_PHRASE = "proves all AI actions are safe";
const NEEDS_PROOF_PHRASE = "live policy checks";

/**
 * S3 chokepoints under test (mirrors src wiring — read-only mapping here):
 * - claim-review → create persuasion review (persuasion-review.ts)
 * - approval-workflow → approve as canon (library.ts)
 * - proofpack-export → toggle public automation enable path (library.ts)
 */
const S3_CHOKES: ReadonlyArray<{ feature: string; action: string }> = [
  { feature: "claim-review", action: "create persuasion review" },
  { feature: "approval-workflow", action: "approve as canon" },
  { feature: "proofpack-export", action: "toggle public automation" },
];

function memoryDb(): WebhookDedupeDb {
  const mem = new Database(":memory:");
  return mem as unknown as WebhookDedupeDb;
}

let eventSeq = 0;
function nextEventId(prefix: string): string {
  eventSeq += 1;
  return `${prefix}_${String(eventSeq).padStart(3, "0")}`;
}

function initiative(): Initiative {
  const found = getInitiativeBySlug(SLUG);
  if (!found) throw new Error(`Seed initiative ${SLUG} not found.`);
  return found;
}

function contentInput(
  status: ContentVersionInput["status"] = "draft",
): ContentVersionInput {
  return {
    ...createEmptyContentVersionInput("Proof-led founder post"),
    status,
    channel: "LinkedIn",
    format: "Founder post",
    objective:
      "Help enterprise platform and security leaders inspect governed execution evidence.",
    audience: "Enterprise platform and security leaders",
    offer: "Governed execution proof walkthrough",
    cta: "Request a proof walkthrough",
    campaignId: "keon-proof-push",
    brandVoiceGuidelineId: "approved-voice",
    brandVoiceSnapshot: "Pinned approved voice v1",
    sourceMaterials: [
      {
        id: "source-1",
        sourceType: "manual-reference",
        label: "Proof brief",
        reference: "proof-brief-v1",
        evidenceNote: "Operator-reviewed internal proof brief.",
      },
    ],
    body: "Enterprise platform and security leaders can inspect the governed execution proof walkthrough because each policy decision leaves reviewable evidence.",
    claimFindings: [],
  };
}

function bannedBody(): string {
  return `Enterprise platform leaders choose governed execution because it ${BANNED_PHRASE} for every buyer.`;
}

function needsProofBody(): string {
  return `Enterprise platform leaders can inspect ${NEEDS_PROOF_PHRASE} during the governed execution proof walkthrough because each policy decision leaves reviewable evidence.`;
}

function bannedFindings(): ContentClaimFinding[] {
  return [
    {
      id: "finding-1",
      handling: "avoid",
      statement: BANNED_PHRASE,
      rationale: "Excluded by initiative canon.",
      origin: "initiative",
    },
  ];
}

function needsProofFindings(): ContentClaimFinding[] {
  return [
    {
      id: "finding-1",
      handling: "needs-proof",
      statement: NEEDS_PROOF_PHRASE,
      rationale: "Requires attributable evidence.",
      origin: "initiative",
    },
  ];
}

function recordOf(overrides: Partial<ContentVersionRecord> = {}): ContentVersionRecord {
  return {
    ...contentInput(),
    id: "content-version-1",
    contentItemId: "content-item-1",
    initiativeSlug: SLUG,
    versionNumber: 1,
    createdAt: "2026-07-22T12:00:00.000Z",
    updatedAt: "2026-07-22T12:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  purgePersuasionReviewData(SLUG);
  purgeContentWorkspaceData(SLUG);
});

afterEach(() => {
  __testOnlyResetEntitlements();
});

// ── int-billing-gate ─────────────────────────────────────────────────────────

describe("int-billing-gate: entitlement gates composed at S3 chokepoints", () => {
  test("S3 chokepoint vocabulary matches the entitlement feature roster", () => {
    expect(S3_CHOKES.map((c) => c.feature).sort()).toEqual(
      [...ENTITLEMENT_FEATURES].sort(),
    );
  });

  test("billing positive: keon (active) passes every gated chokepoint", () => {
    for (const { feature, action } of S3_CHOKES) {
      const decision = requireEntitlement(KEON, feature);
      expect(decision.allowed).toBe(true);
      if (!decision.allowed) throw new Error(`unreachable: keon ${feature} must pass`);
      expect(decision.entitlement.status).toBe("active");
      expect(enforceEntitlement(KEON, feature, action).status).toBe("active");
    }
  });

  test("billing negative: biostack (lapsed) is gated ENTITLEMENT_INACTIVE at the same chokepoints", () => {
    for (const { feature, action } of S3_CHOKES) {
      const decision = requireEntitlement(BIOSTACK, feature);
      expect(decision.allowed).toBe(false);
      if (decision.allowed) throw new Error(`unreachable: biostack ${feature} must gate`);
      expect(decision.denialCode).toBe("ENTITLEMENT_INACTIVE");
      expect(decision.failureStage).toBe("decision");
      expect(decision.denialMessage).toMatch(/lapsed/);
      try {
        enforceEntitlement(BIOSTACK, feature, action);
        throw new Error(`unreachable: biostack ${feature} must throw`);
      } catch (error) {
        expect(error).toBeInstanceOf(EntitlementGateError);
        const gate = error as EntitlementGateError;
        expect(gate.httpStatus).toBe(403);
        expect(gate.denialCode).toBe("ENTITLEMENT_INACTIVE");
        expect(gate.failureStage).toBe("decision");
      }
    }
  });

  test("webhook payment_failed flips a tenant from pass to gated", () => {
    expect(requireEntitlement(KEON, "claim-review").allowed).toBe(true);
    const failed = ingestBillingWebhookEvent(
      {
        eventId: nextEventId("evt_int_billing_failed"),
        type: "invoice.payment_failed",
        created: "2026-09-10T12:00:00Z",
        tenantId: KEON,
        data: { billingReason: "subscription_cycle", attemptCount: 1 },
      },
      { testMode: true, db: memoryDb() },
    );
    expect(failed).toMatchObject({ ok: true, deduped: false });
    if (!failed.ok || failed.deduped) throw new Error("unreachable");
    expect(failed.outcome).toBe("lapsed");
    const gated = requireEntitlement(KEON, "claim-review");
    expect(gated.allowed).toBe(false);
    if (gated.allowed) throw new Error("unreachable");
    expect(gated.denialCode).toBe("ENTITLEMENT_INACTIVE");
    expect(gated.failureStage).toBe("decision");
  });

  test("replay of the same eventId applies exactly once (deduped:true)", () => {
    const db = memoryDb();
    const body = {
      eventId: nextEventId("evt_int_billing_replay"),
      type: "checkout.session.completed" as const,
      created: "2026-09-10T10:00:00Z",
      tenantId: KEON,
      data: { mode: "subscription", paymentStatus: "paid" },
    };
    const first = ingestBillingWebhookEvent(body, { testMode: true, db });
    expect(first).toMatchObject({ ok: true, deduped: false });
    if (!first.ok || first.deduped) throw new Error("unreachable");
    expect(first.outcome).toBe("active");

    const second = ingestBillingWebhookEvent(body, { testMode: true, db });
    expect(second).toEqual({
      ok: true,
      deduped: true,
      eventId: body.eventId,
      tenantId: KEON,
    });

    const rows = (db as unknown as Database.Database)
      .prepare(`SELECT COUNT(*) AS n FROM billing_webhook_events WHERE event_id = ?`)
      .get(body.eventId) as { n: number };
    expect(rows.n).toBe(1);
  });
});

// ── int-claim-block ──────────────────────────────────────────────────────────

describe("int-claim-block: claim gates hold under composition", () => {
  test("claim positive: safe content flows through the S4 apply gate", () => {
    expect(evaluateClaim({ initiative: initiative(), text: contentInput().body })).toBe(
      "safe",
    );
    const review = createPersuasionReview(
      buildPersuasionReview(recordOf(), []),
    );
    expect(deriveReviewClaimVerdict(review)).toBe("safe");
    const gate = decideClaimApply({
      review,
      suggestedFindings: [],
      evidenceRefs: claimEvidenceRefsForSources(review.sourceMaterials),
      hasApproval: false,
    });
    expect(gate.verdict).toBe("safe");
    expect(gate.rationale).toContain(CLAIM_POLICY_VERSION);
  });

  test("blocked: banned content is refused even for entitled keon (trust does NOT yield to money)", () => {
    // Money side passes — this is the point: entitlement must not authorize
    // banned content.
    const money = requireEntitlement(KEON, "claim-review");
    expect(money.allowed).toBe(true);

    const review = createPersuasionReview(
      buildPersuasionReview(recordOf({ body: bannedBody() }), bannedFindings()),
    );
    expect(deriveReviewClaimVerdict(review)).toBe("blocked");

    // Even a recorded approval plus attached evidence can never authorize it.
    try {
      decideClaimApply({
        review,
        suggestedFindings: bannedFindings(),
        evidenceRefs: claimEvidenceRefsForSources(review.sourceMaterials),
        hasApproval: true,
      });
      throw new Error("unreachable: banned apply must be refused for entitled tenants");
    } catch (error) {
      expect(error).toBeInstanceOf(ClaimGateError);
      const gate = error as ClaimGateError;
      expect(gate.denialCode).toBe("CLAIM_BLOCKED");
      expect(gate.failureStage).toBe("decision");
      expect(gate.httpStatus).toBe(403);
    }

    // Explicit inversion guard: no money-over-trust path exists in this
    // composition — the entitled tenant is still blocked.
    expect(money.allowed).toBe(true);
    expect(deriveReviewClaimVerdict(review)).toBe("blocked");
  });

  test("claim failure: eval-failure input → needs-review, never silent allow", () => {
    expect(evaluateClaim({ initiative: initiative(), text: "" })).toBe("needs-review");
    expect(evaluateClaim({ initiative: initiative(), text: "   " })).toBe("needs-review");
    expect(evaluateClaim({ initiative: initiative(), text: 42 })).toBe("needs-review");
    expect(evaluateClaim({ initiative: null, text: needsProofBody() })).toBe("needs-review");
    expect(
      evaluateClaim({
        initiative: { ...initiative(), bannedClaims: null } as unknown as Initiative,
        text: needsProofBody(),
      }),
    ).toBe("needs-review");

    const detailed = evaluateClaimDetailed({ initiative: null, text: needsProofBody() });
    expect(detailed.verdict).toBe("needs-review");
    expect(detailed.policyVersion).toBe(CLAIM_POLICY_VERSION);
    expect(detailed.rationale).toContain(CLAIM_POLICY_VERSION);
  });

  test("apply without approval → APPROVAL_REQUIRED with a readable receipt", () => {
    const review = createPersuasionReview(
      buildPersuasionReview(recordOf({ body: needsProofBody() }), needsProofFindings()),
    );
    expect(deriveReviewClaimVerdict(review)).toBe("needs-review");

    try {
      decideClaimApply({
        review,
        suggestedFindings: needsProofFindings(),
        evidenceRefs: claimEvidenceRefsForSources(review.sourceMaterials),
        hasApproval: false,
      });
      throw new Error("unreachable: needs-review apply without approval must be refused");
    } catch (error) {
      expect(error).toBeInstanceOf(ClaimGateError);
      const gate = error as ClaimGateError;
      expect(gate.denialCode).toBe("APPROVAL_REQUIRED");
      expect(gate.failureStage).toBe("decision");
      expect(gate.httpStatus).toBe(403);
      recordClaimDecisionReceipt({
        reviewId: review.id,
        contentVersionId: review.contentVersionId,
        initiativeSlug: review.initiativeSlug,
        verdict: "needs-review",
        rationale: `Apply refused: ${gate.denialMessage}`,
        evidenceRefs: claimEvidenceRefsForSources(review.sourceMaterials),
      });
    }

    const receipts = listClaimDecisionReceipts(review.id);
    expect(receipts.length).toBeGreaterThanOrEqual(1);
    expect(receipts[0].summary).toContain(CLAIM_POLICY_VERSION);
    expect(receipts[0].summary).toContain("Proof brief — proof-brief-v1");
    expect(receipts[0].verificationState).toBe("recorded");
  });
});

// ── composed money × trust matrix ────────────────────────────────────────────

describe("composed money × trust matrix", () => {
  test("lapsed + banned → both denials present (no gate masks the other)", () => {
    const entitlement = requireEntitlement(BIOSTACK, "claim-review");
    expect(entitlement.allowed).toBe(false);
    if (entitlement.allowed) throw new Error("unreachable");
    expect(entitlement.denialCode).toBe("ENTITLEMENT_INACTIVE");
    expect(entitlement.failureStage).toBe("decision");

    const review = createPersuasionReview(
      buildPersuasionReview(recordOf({ body: bannedBody() }), bannedFindings()),
    );
    expect(deriveReviewClaimVerdict(review)).toBe("blocked");
    try {
      decideClaimApply({
        review,
        suggestedFindings: bannedFindings(),
        evidenceRefs: claimEvidenceRefsForSources(review.sourceMaterials),
        hasApproval: false,
      });
      throw new Error("unreachable: lapsed+banned apply must be refused");
    } catch (error) {
      expect(error).toBeInstanceOf(ClaimGateError);
      expect((error as ClaimGateError).denialCode).toBe("CLAIM_BLOCKED");
      expect((error as ClaimGateError).failureStage).toBe("decision");
    }

    // Both signals survive composition: the money denial and the trust denial
    // are independently observable.
    expect(entitlement.denialCode).toBe("ENTITLEMENT_INACTIVE");
    expect(deriveReviewClaimVerdict(review)).toBe("blocked");
  });

  test("entitlement check leaks no claim details across tenants", () => {
    // Keon-scoped banned review exists; a biostack session must not reach it.
    const keonReview = createPersuasionReview(
      buildPersuasionReview(recordOf({ body: bannedBody() }), bannedFindings()),
    );
    expect(deriveReviewClaimVerdict(keonReview)).toBe("blocked");

    try {
      requirePersuasionRowTenant(
        BIOSTACK,
        { tenantId: KEON, id: keonReview.id },
        "apply persuasion review",
      );
      throw new Error("unreachable: cross-tenant review access must be denied");
    } catch (error) {
      expect(error).toBeInstanceOf(TenantScopeError);
      const scope = error as TenantScopeError;
      expect(scope.httpStatus).toBe(403);
      expect(scope.denialCode).toBe("TENANT_MISMATCH");
      expect(scope.failureStage).toBe("decision");
      expect(String(scope.message)).not.toContain(BANNED_PHRASE);
    }

    // The entitlement denial for the lapsed tenant carries no claim payload.
    const denial = requireEntitlement(BIOSTACK, "claim-review");
    expect(denial.allowed).toBe(false);
    if (denial.allowed) throw new Error("unreachable");
    expect(denial.denialMessage).not.toContain(BANNED_PHRASE);
    expect(denial.denialMessage).not.toContain(NEEDS_PROOF_PHRASE);
    expect(denial.tenantId).toBe(BIOSTACK);
  });
});
