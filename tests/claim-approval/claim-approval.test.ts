/**
 * w2-claim-approval-wire — strict claim-gate evidence (surface S4
 * claim-approval-receipt, release gate w2-wired).
 *
 * - Banned content → blocked; apply refused with CLAIM_BLOCKED.
 * - Needs-proof content without evidence → needs-review; apply refused with
 *   APPROVAL_REQUIRED until a recorded approved ApprovalState exists for the
 *   review id AND evidence refs are attached.
 * - Recorded approval + evidence → apply allowed (draft revision only).
 * - Eval failure / empty input → needs-review (fail-closed).
 * - Every decision leaves a readable receipt carrying CLAIM_POLICY_VERSION,
 *   evidence refs, and the rationale.
 * - Tenant mismatch still denies 403 (no regression on #23/#27 wiring).
 */
import { beforeEach, describe, expect, test } from "vitest";

import { TenantScopeError } from "@/lib/auth/session";
import { CLAIM_POLICY_VERSION, evaluateClaim, evaluateClaimDetailed } from "@/lib/claims/policy";
import {
  createContentItem,
  createContentVersion,
  purgeContentWorkspaceData,
} from "@/lib/content-workspace/repository";
import {
  createEmptyContentVersionInput,
  type ContentClaimFinding,
  type ContentVersionInput,
  type ContentVersionRecord,
} from "@/lib/content-workspace/types";
import { getInitiativeBySlug } from "@/lib/initiatives/repository";
import type { Initiative } from "@/lib/initiatives/types";
import {
  createPersuasionReview,
  getLatestClaimApprovalForReview,
  hasApprovedClaimApproval,
  listClaimDecisionReceipts,
  purgePersuasionReviewData,
  recordClaimApproval,
  recordClaimDecisionReceipt,
  requireRowTenantMatch as requirePersuasionRowTenant,
} from "@/lib/persuasion-review/repository";
import {
  assertReviewApplicable,
  buildPersuasionReview,
  ClaimGateError,
  claimEvidenceRefsForSources,
  createPersuasionRevisionInput,
  decideClaimApply,
  deriveReviewClaimVerdict,
} from "@/lib/persuasion-review/service";

const slug = "keon-systems";
const BANNED_PHRASE = "proves all AI actions are safe";
const NEEDS_PROOF_PHRASE = "live policy checks";

function initiative(): Initiative {
  const found = getInitiativeBySlug(slug);
  if (!found) throw new Error(`Seed initiative ${slug} not found.`);
  return found;
}

function content(status: ContentVersionInput["status"] = "draft"): ContentVersionInput {
  return {
    ...createEmptyContentVersionInput("Proof-led founder post"),
    status,
    channel: "LinkedIn",
    format: "Founder post",
    objective: "Help enterprise platform and security leaders inspect governed execution evidence.",
    audience: "Enterprise platform and security leaders",
    offer: "Governed execution proof walkthrough",
    cta: "Request a proof walkthrough",
    campaignId: "keon-proof-push",
    brandVoiceGuidelineId: "approved-voice",
    brandVoiceSnapshot: "Pinned approved voice v1",
    sourceMaterials: [{
      id: "source-1",
      sourceType: "manual-reference",
      label: "Proof brief",
      reference: "proof-brief-v1",
      evidenceNote: "Operator-reviewed internal proof brief.",
    }],
    body: "Enterprise platform and security leaders can inspect the governed execution proof walkthrough because each policy decision leaves reviewable evidence.",
    claimFindings: [],
  };
}

function bannedBody() {
  return `Enterprise platform leaders choose governed execution because it ${BANNED_PHRASE} for every buyer.`;
}

function needsProofBody() {
  return `Enterprise platform leaders can inspect ${NEEDS_PROOF_PHRASE} during the governed execution proof walkthrough because each policy decision leaves reviewable evidence.`;
}

function bannedFindings(): ContentClaimFinding[] {
  return [{
    id: "finding-1",
    handling: "avoid",
    statement: BANNED_PHRASE,
    rationale: "Excluded by initiative canon.",
    origin: "initiative",
  }];
}

function needsProofFindings(): ContentClaimFinding[] {
  return [{
    id: "finding-1",
    handling: "needs-proof",
    statement: NEEDS_PROOF_PHRASE,
    rationale: "Requires attributable evidence.",
    origin: "initiative",
  }];
}

function record(overrides: Partial<ContentVersionRecord> = {}): ContentVersionRecord {
  return {
    ...content(),
    id: "content-version-1",
    contentItemId: "content-item-1",
    initiativeSlug: slug,
    versionNumber: 1,
    createdAt: "2026-07-22T12:00:00.000Z",
    updatedAt: "2026-07-22T12:00:00.000Z",
    ...overrides,
  };
}

function evidenceRefsFor(recorded: ContentVersionRecord): string[] {
  return claimEvidenceRefsForSources(recorded.sourceMaterials);
}

/** Mirror of the server action refusal path (gate denial → receipt). */
function refuseWithReceipt(
  reviewId: string,
  contentVersionId: string,
  verdict: "blocked" | "needs-review" | "safe",
  message: string,
  evidenceRefs: string[],
) {
  return recordClaimDecisionReceipt({
    reviewId,
    contentVersionId,
    initiativeSlug: slug,
    verdict,
    rationale: `Apply refused: ${message}`,
    evidenceRefs,
  });
}

beforeEach(() => {
  purgePersuasionReviewData(slug);
  purgeContentWorkspaceData(slug);
});

describe("claim policy (strict, fail-closed)", () => {
  test("policy version is claim-policy.v1", () => {
    expect(CLAIM_POLICY_VERSION).toBe("claim-policy.v1");
  });

  test("banned match → blocked", () => {
    expect(evaluateClaim({ initiative: initiative(), text: bannedBody() })).toBe("blocked");
    const detailed = evaluateClaimDetailed({ initiative: initiative(), text: bannedBody() });
    expect(detailed.verdict).toBe("blocked");
    expect(detailed.policyVersion).toBe(CLAIM_POLICY_VERSION);
    expect(detailed.bannedMatches).toContain(BANNED_PHRASE);
    expect(detailed.rationale).toContain(CLAIM_POLICY_VERSION);
  });

  test("needs-proof match without evidence → needs-review", () => {
    expect(evaluateClaim({ initiative: initiative(), text: needsProofBody() })).toBe("needs-review");
    const detailed = evaluateClaimDetailed({ initiative: initiative(), text: needsProofBody() });
    expect(detailed.needsProofMatches).toContain(NEEDS_PROOF_PHRASE);
    expect(detailed.rationale).toContain(CLAIM_POLICY_VERSION);
  });

  test("needs-proof match with evidence stays needs-review until approval", () => {
    // Strict by design: evidence is a prerequisite for approval, never a
    // substitute for it — attached evidence must not downgrade the verdict.
    const verdict = evaluateClaim({
      initiative: initiative(),
      text: needsProofBody(),
      evidenceRefs: ["Proof brief — proof-brief-v1"],
    });
    expect(verdict).toBe("needs-review");
  });

  test("clean content → safe", () => {
    expect(evaluateClaim({ initiative: initiative(), text: content().body })).toBe("safe");
  });

  test("eval failure and empty input → needs-review (fail-closed)", () => {
    expect(evaluateClaim({ initiative: initiative(), text: "" })).toBe("needs-review");
    expect(evaluateClaim({ initiative: initiative(), text: "   " })).toBe("needs-review");
    expect(evaluateClaim({ initiative: initiative(), text: 42 })).toBe("needs-review");
    expect(evaluateClaim({ initiative: null, text: needsProofBody() })).toBe("needs-review");
    expect(evaluateClaim({ initiative: undefined, text: needsProofBody() })).toBe("needs-review");
    expect(
      evaluateClaim({
        initiative: { ...initiative(), bannedClaims: null } as unknown as Initiative,
        text: needsProofBody(),
      }),
    ).toBe("needs-review");
  });
});

describe("claim gate on persuasion reviews", () => {
  test("banned review → blocked and apply refused with CLAIM_BLOCKED", () => {
    const review = createPersuasionReview(
      buildPersuasionReview(record({ body: bannedBody() }), bannedFindings()),
    );
    expect(deriveReviewClaimVerdict(review)).toBe("blocked");

    // Even a recorded approval plus evidence can never authorize banned content.
    recordClaimApproval({
      reviewId: review.id,
      contentVersionId: review.contentVersionId,
      initiativeSlug: review.initiativeSlug,
      requestedBy: "tenant-keon",
      reviewedBy: "tenant-keon",
      notes: "Attempted approval of blocked content (must not authorize).",
    });
    try {
      decideClaimApply({
        review,
        suggestedFindings: bannedFindings(),
        evidenceRefs: evidenceRefsFor(review),
        hasApproval: hasApprovedClaimApproval(review.id),
      });
      throw new Error("unreachable: blocked apply must be refused");
    } catch (error) {
      expect(error).toBeInstanceOf(ClaimGateError);
      const gate = error as ClaimGateError;
      expect(gate.denialCode).toBe("CLAIM_BLOCKED");
      expect(gate.failureStage).toBe("decision");
      expect(gate.httpStatus).toBe(403);
      refuseWithReceipt(review.id, review.contentVersionId, "blocked", gate.denialMessage, evidenceRefsFor(review));
    }

    const receipts = listClaimDecisionReceipts(review.id);
    expect(receipts.length).toBeGreaterThanOrEqual(1);
    expect(receipts[0].summary).toContain(CLAIM_POLICY_VERSION);
    expect(receipts[0].summary).toContain("Proof brief — proof-brief-v1");
    expect(receipts[0].verificationState).toBe("recorded");
  });

  test("needs-proof without approval → needs-review and apply refused with APPROVAL_REQUIRED", () => {
    const review = createPersuasionReview(
      buildPersuasionReview(record({ body: needsProofBody() }), needsProofFindings()),
    );
    expect(deriveReviewClaimVerdict(review)).toBe("needs-review");
    expect(hasApprovedClaimApproval(review.id)).toBe(false);

    try {
      decideClaimApply({
        review,
        suggestedFindings: needsProofFindings(),
        evidenceRefs: evidenceRefsFor(review),
        hasApproval: false,
      });
      throw new Error("unreachable: needs-review apply without approval must be refused");
    } catch (error) {
      expect(error).toBeInstanceOf(ClaimGateError);
      const gate = error as ClaimGateError;
      expect(gate.denialCode).toBe("APPROVAL_REQUIRED");
      expect(gate.failureStage).toBe("decision");
      refuseWithReceipt(review.id, review.contentVersionId, "needs-review", gate.denialMessage, evidenceRefsFor(review));
    }

    // Default (unapproved) applicability still refuses the blocked flag.
    expect(() =>
      assertReviewApplicable(review, record({ body: needsProofBody() }), needsProofFindings()),
    ).toThrow(/blocked/i);

    const receipts = listClaimDecisionReceipts(review.id);
    expect(receipts.length).toBeGreaterThanOrEqual(1);
    expect(receipts[0].summary).toContain(CLAIM_POLICY_VERSION);
  });

  test("recorded approval plus evidence → apply allowed (draft only) with approved-apply receipt", () => {
    const source = createContentItem(slug, { ...content(), body: needsProofBody() });
    const review = createPersuasionReview(
      buildPersuasionReview(source, needsProofFindings()),
    );
    expect(deriveReviewClaimVerdict(review)).toBe("needs-review");
    recordClaimDecisionReceipt({
      reviewId: review.id,
      contentVersionId: review.contentVersionId,
      initiativeSlug: review.initiativeSlug,
      verdict: "needs-review",
      rationale: "Needs-proof claims require evidence and approval.",
      evidenceRefs: evidenceRefsFor(review),
    });

    const approval = recordClaimApproval({
      reviewId: review.id,
      contentVersionId: review.contentVersionId,
      initiativeSlug: review.initiativeSlug,
      requestedBy: "tenant-keon",
      requestedByDisplayName: "tenant-keon",
      reviewedBy: "tenant-keon",
      reviewedByDisplayName: "tenant-keon",
      notes: "Operator verified the proof brief backing live policy checks.",
    });
    expect(approval.decision).toBe("approved");
    expect(approval.subjectEntityId).toBe(review.id);
    expect(hasApprovedClaimApproval(review.id)).toBe(true);
    expect(getLatestClaimApprovalForReview(review.id)?.decision).toBe("approved");

    const gate = decideClaimApply({
      review,
      suggestedFindings: needsProofFindings(),
      evidenceRefs: evidenceRefsFor(source),
      hasApproval: hasApprovedClaimApproval(review.id),
    });
    expect(gate.verdict).toBe("needs-review");

    // Approved needs-review applies through the waiver; the source stays
    // untouched and a new editable draft is created (never published).
    assertReviewApplicable(review, source, needsProofFindings(), { approvedNeedsReview: true });
    const revision = createContentVersion(source.id, createPersuasionRevisionInput(review, needsProofFindings()));
    expect(revision.status).toBe("draft");
    expect(revision.versionNumber).toBe(2);

    const applied = recordClaimDecisionReceipt({
      reviewId: review.id,
      contentVersionId: source.id,
      initiativeSlug: review.initiativeSlug,
      verdict: "approved-apply",
      rationale: gate.rationale,
      evidenceRefs: evidenceRefsFor(source),
    });
    expect(applied.kind).toBe("approval");

    const receipts = listClaimDecisionReceipts(review.id);
    expect(receipts.length).toBeGreaterThanOrEqual(2);
    for (const receipt of receipts) {
      expect(receipt.summary).toContain(CLAIM_POLICY_VERSION);
    }
    expect(receipts.some((receipt) => receipt.summary.includes("verdict=approved-apply"))).toBe(true);
  });

  test("needs-review with approval but no evidence → still APPROVAL_REQUIRED", () => {
    const review = createPersuasionReview(
      buildPersuasionReview(
        record({ body: needsProofBody(), sourceMaterials: [] }),
        needsProofFindings(),
      ),
    );
    recordClaimApproval({
      reviewId: review.id,
      contentVersionId: review.contentVersionId,
      initiativeSlug: review.initiativeSlug,
      requestedBy: "tenant-keon",
      reviewedBy: "tenant-keon",
    });
    try {
      decideClaimApply({
        review,
        suggestedFindings: needsProofFindings(),
        evidenceRefs: [],
        hasApproval: true,
      });
      throw new Error("unreachable: approval without evidence must be refused");
    } catch (error) {
      expect(error).toBeInstanceOf(ClaimGateError);
      expect((error as ClaimGateError).denialCode).toBe("APPROVAL_REQUIRED");
      expect((error as ClaimGateError).failureStage).toBe("decision");
    }
  });

  test("every decision leaves a readable receipt with policy version", () => {
    const blockedReview = createPersuasionReview(
      buildPersuasionReview(record({ body: bannedBody() }), bannedFindings()),
    );
    recordClaimDecisionReceipt({
      reviewId: blockedReview.id,
      contentVersionId: blockedReview.contentVersionId,
      initiativeSlug: blockedReview.initiativeSlug,
      verdict: "blocked",
      rationale: "Banned claim match requires removal.",
      evidenceRefs: evidenceRefsFor(blockedReview),
    });

    const needsReview = createPersuasionReview(
      buildPersuasionReview(record({ body: needsProofBody() }), needsProofFindings()),
    );
    recordClaimDecisionReceipt({
      reviewId: needsReview.id,
      contentVersionId: needsReview.contentVersionId,
      initiativeSlug: needsReview.initiativeSlug,
      verdict: "needs-review",
      rationale: "Needs-proof claims require evidence and approval.",
      evidenceRefs: evidenceRefsFor(needsReview),
    });

    for (const review of [blockedReview, needsReview]) {
      const receipts = listClaimDecisionReceipts(review.id);
      expect(receipts).toHaveLength(1);
      const [receipt] = receipts;
      expect(receipt.subjectEntityId).toBe(review.contentVersionId);
      expect(receipt.summary).toContain(CLAIM_POLICY_VERSION);
      expect(receipt.summary).toContain("Proof brief — proof-brief-v1");
      expect(receipt.summary).toContain("rationale=");
      expect(receipt.verificationState).toBe("recorded");
    }
    expect(listClaimDecisionReceipts(blockedReview.id)[0].kind).toBe("verification");
  });

  test("tenant mismatch still denies 403 (no regression on #23 wiring)", () => {
    try {
      requirePersuasionRowTenant(
        "tenant-keon",
        { tenantId: "tenant-biostack" },
        "apply persuasion review",
      );
      throw new Error("unreachable: cross-tenant row must be denied");
    } catch (error) {
      expect(error).toBeInstanceOf(TenantScopeError);
      const scope = error as TenantScopeError;
      expect(scope.httpStatus).toBe(403);
      expect(scope.denialCode).toBe("TENANT_MISMATCH");
      expect(scope.failureStage).toBe("decision");
    }
    expect(requirePersuasionRowTenant("tenant-keon", { tenantId: "tenant-keon" }, "apply persuasion review")).toBe(
      "tenant-keon",
    );
  });
});
