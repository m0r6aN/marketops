/**
 * k2-deliberation-evidence — S10 deliberation as claim-review EVIDENCE.
 *
 * Doctrine: deliberation produces CANDIDATES, never execution authority;
 * confidence is information, never authority; tenant-scoped.
 *
 * - Valid candidates attach as evidence refs on the review + receipt path.
 * - Permission/authority/approval-effect payloads are rejected fail-closed.
 * - Missing adversarial review caps advancement at needs-review.
 * - Confidence 1.0 NEVER approves (critical authority test).
 * - Dissent is preserved verbatim into receipt refs.
 * - Cross-tenant candidates are rejected.
 */
import { beforeEach, describe, expect, test } from "vitest";

import { CLAIM_POLICY_VERSION } from "@/lib/claims/policy";
import {
  purgeContentWorkspaceData,
} from "@/lib/content-workspace/repository";
import type {
  ContentClaimFinding,
  ContentVersionInput,
  ContentVersionRecord,
} from "@/lib/content-workspace/types";
import { createEmptyContentVersionInput } from "@/lib/content-workspace/types";
import {
  acceptCandidate,
  capClaimVerdictForDeliberation,
  DeliberationError,
  hasAdversarialReview,
  toClaimEvidence,
} from "@/lib/keon/deliberation";
import type { DeliberationCandidate } from "@/lib/keon/types";
import {
  createPersuasionReview,
  hasApprovedClaimApproval,
  listClaimDecisionEvidenceRefs,
  listClaimDecisionReceipts,
  purgePersuasionReviewData,
  recordClaimDecisionReceiptWithDeliberation,
} from "@/lib/persuasion-review/repository";
import {
  buildPersuasionReview,
  ClaimGateError,
  claimEvidenceRefsForSources,
  claimEvidenceRefsWithDeliberation,
  decideClaimApply,
  deriveReviewClaimVerdict,
  mergeClaimEvidenceRefs,
  resolveClaimVerdictWithDeliberation,
} from "@/lib/persuasion-review/service";
import fixture from "../contracts/fixtures/keon/deliberation-candidate.json";

const slug = "keon-systems";
const TENANT = "tenant-keon";
const FOREIGN_TENANT = "tenant-biostack";
const NEEDS_PROOF_PHRASE = "live policy checks";

function contentInput(body: string): ContentVersionInput {
  return {
    ...createEmptyContentVersionInput("Deliberation evidence post"),
    status: "draft",
    channel: "LinkedIn",
    format: "Founder post",
    objective: "Help enterprise platform leaders inspect governed execution evidence.",
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
    body,
    claimFindings: [],
  };
}

function record(overrides: Partial<ContentVersionRecord> = {}): ContentVersionRecord {
  return {
    ...contentInput(
      "Enterprise platform and security leaders can inspect the governed execution proof walkthrough because each policy decision leaves reviewable evidence.",
    ),
    id: "content-version-delib-1",
    contentItemId: "content-item-delib-1",
    initiativeSlug: slug,
    versionNumber: 1,
    createdAt: "2026-09-14T00:00:00.000Z",
    updatedAt: "2026-09-14T00:00:00.000Z",
    ...overrides,
  };
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

function needsProofBody(): string {
  return `Enterprise platform leaders can inspect ${NEEDS_PROOF_PHRASE} during the governed execution proof walkthrough because each policy decision leaves reviewable evidence.`;
}

function validPayload(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(fixture)) as Record<string, unknown>;
}

function expectDeliberationCode(fn: () => unknown, code: DeliberationError["code"]): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(DeliberationError);
    expect((error as DeliberationError).code).toBe(code);
    return;
  }
  expect.unreachable(`expected DeliberationError ${code}`);
}

beforeEach(() => {
  purgePersuasionReviewData(slug);
  purgeContentWorkspaceData(slug);
});

describe("k2 deliberation evidence intake", () => {
  test("valid candidate attaches as evidence on the review + receipt path", () => {
    const candidate = acceptCandidate(validPayload(), { expectedTenantId: TENANT });
    expect(candidate.candidate.branch).toBe(
      (fixture as DeliberationCandidate).candidate.branch,
    );

    const refs = toClaimEvidence(candidate);
    expect(refs.length).toBeGreaterThanOrEqual(4);
    expect(refs.some((ref) => ref.includes(candidate.candidate.rationale))).toBe(true);
    expect(refs.some((ref) => ref.includes(candidate.dissent))).toBe(true);
    expect(
      refs.some((ref) => ref.includes(String(candidate.confidence.value)) &&
        ref.includes(candidate.confidence.calibrationVersion)),
    ).toBe(true);

    // Creation-path wiring: source refs + deliberation refs merge additively.
    const version = record();
    const merged = claimEvidenceRefsWithDeliberation(version.sourceMaterials, candidate);
    expect(merged).toContain("Proof brief — proof-brief-v1");
    for (const ref of refs) expect(merged).toContain(ref);
    expect(mergeClaimEvidenceRefs(merged, refs)).toEqual(merged);

    const review = createPersuasionReview(buildPersuasionReview(version, []));
    const receipt = recordClaimDecisionReceiptWithDeliberation({
      reviewId: review.id,
      contentVersionId: review.contentVersionId,
      initiativeSlug: review.initiativeSlug,
      verdict: deriveReviewClaimVerdict(review),
      rationale: "Safe review with deliberation evidence attached.",
      evidenceRefs: claimEvidenceRefsForSources(review.sourceMaterials),
      deliberation: candidate,
    });
    expect(receipt.summary).toContain(CLAIM_POLICY_VERSION);
    expect(receipt.summary).toContain(`deliberation ${candidate.candidate.branch}`);
    const storedRefs = listClaimDecisionEvidenceRefs(review.id);
    for (const ref of refs) expect(storedRefs).toContain(ref);
  });

  test("permission-bearing payloads are rejected fail-closed", () => {
    const base = validPayload();
    // Top-level authority-shaped unknowns.
    for (const poison of [
      { grantsExecutionAuthority: true },
      { executesAction: "campaign.publish" },
      { permission: "allow" },
      { authorizedEffect: "campaign.publish" },
      { allowExecution: true },
      { approval: "approved" },
      { authority: "admin" },
    ]) {
      expectDeliberationCode(
        () => acceptCandidate({ ...base, ...poison }, { expectedTenantId: TENANT }),
        "DELIBERATION_AUTHORITY_FORBIDDEN",
      );
    }
    // Nested authority-shaped keys are also rejected.
    const nested = validPayload() as Record<string, unknown> & {
      candidate: Record<string, unknown>;
      lineage: Record<string, unknown>;
    };
    expectDeliberationCode(
      () =>
        acceptCandidate(
          { ...nested, candidate: { ...(nested.candidate as object), approvalEffect: "approve" } },
          { expectedTenantId: TENANT },
        ),
      "DELIBERATION_AUTHORITY_FORBIDDEN",
    );
    expectDeliberationCode(
      () =>
        acceptCandidate(
          {
            ...nested,
            lineage: { ...(nested.lineage as object), permitCrossTenant: true },
            challenges: [
              {
                challenge: "Scoped claim needs prod proof.",
                execute: "campaign.publish",
              },
            ],
          },
          { expectedTenantId: TENANT },
        ),
      "DELIBERATION_AUTHORITY_FORBIDDEN",
    );
    // Unknown non-authority fields still fail closed (allowlist only).
    expectDeliberationCode(
      () => acceptCandidate({ ...base, mysteryField: "x" }, { expectedTenantId: TENANT }),
      "DELIBERATION_INVALID",
    );
    // Missing required evidence fields fail closed.
    const noDissent = validPayload();
    delete noDissent.dissent;
    expectDeliberationCode(
      () => acceptCandidate(noDissent, { expectedTenantId: TENANT }),
      "DELIBERATION_INVALID",
    );
  });

  test("missing adversarial review caps advancement at needs-review", () => {
    const reviewed = acceptCandidate(validPayload(), { expectedTenantId: TENANT });
    expect(hasAdversarialReview(reviewed)).toBe(true);

    const unreviewedPayload = validPayload();
    (unreviewedPayload as { challenges: unknown[] }).challenges = [];
    (unreviewedPayload as { dissent: string }).dissent = "none-voiced";
    const unreviewed = acceptCandidate(unreviewedPayload, { expectedTenantId: TENANT });
    expect(hasAdversarialReview(unreviewed)).toBe(false);

    // Gate: safe cannot advance past needs-review without demonstrated review.
    expect(capClaimVerdictForDeliberation("safe", unreviewed)).toBe("needs-review");
    expect(resolveClaimVerdictWithDeliberation("safe", unreviewed)).toBe("needs-review");
    // Reviewed candidates impose no cap through this gate (still never approve).
    expect(capClaimVerdictForDeliberation("safe", reviewed)).toBe("safe");
    // Blocked / needs-review pass through unchanged either way.
    expect(capClaimVerdictForDeliberation("blocked", unreviewed)).toBe("blocked");
    expect(capClaimVerdictForDeliberation("needs-review", unreviewed)).toBe("needs-review");
  });

  test("confidence=1.0 does NOT approve (critical authority test)", () => {
    const payload = validPayload();
    (payload as { confidence: unknown }).confidence = {
      value: 1.0,
      calibrationVersion: "calib.v3",
    };
    const candidate = acceptCandidate(payload, { expectedTenantId: TENANT });
    expect(candidate.confidence.value).toBe(1.0);
    const deliberationRefs = toClaimEvidence(candidate);
    // Projection carries no approval language.
    for (const ref of deliberationRefs) {
      expect(ref.toLowerCase()).not.toContain("approved-apply");
      expect(ref.toLowerCase()).not.toContain("authorized");
    }
    expect(deliberationRefs.some((ref) => ref.includes("advisory only"))).toBe(true);

    // Needs-proof review + full deliberation evidence but NO human approval
    // must still refuse — deliberation is uncertainty material, never authority.
    const review = createPersuasionReview(
      buildPersuasionReview(record({ body: needsProofBody() }), needsProofFindings()),
    );
    expect(deriveReviewClaimVerdict(review)).toBe("needs-review");
    expect(hasApprovedClaimApproval(review.id)).toBe(false);
    const evidenceRefs = mergeClaimEvidenceRefs(
      claimEvidenceRefsForSources(review.sourceMaterials),
      deliberationRefs,
    );
    expect(evidenceRefs.length).toBeGreaterThan(1);
    try {
      decideClaimApply({
        review,
        suggestedFindings: needsProofFindings(),
        evidenceRefs,
        hasApproval: hasApprovedClaimApproval(review.id),
      });
      throw new Error("unreachable: confidence 1.0 must not approve without human approval");
    } catch (error) {
      expect(error).toBeInstanceOf(ClaimGateError);
      expect((error as ClaimGateError).denialCode).toBe("APPROVAL_REQUIRED");
    }
  });

  test("dissent is preserved verbatim into receipt refs", () => {
    const candidate = acceptCandidate(validPayload(), { expectedTenantId: TENANT });
    const dissent = candidate.dissent;
    expect(dissent.length).toBeGreaterThan(0);

    const refs = toClaimEvidence(candidate);
    const dissentRefs = refs.filter((ref) => ref.includes("dissent"));
    expect(dissentRefs.length).toBeGreaterThanOrEqual(1);
    expect(dissentRefs.some((ref) => ref.includes(dissent))).toBe(true);

    const review = createPersuasionReview(buildPersuasionReview(record(), []));
    recordClaimDecisionReceiptWithDeliberation({
      reviewId: review.id,
      contentVersionId: review.contentVersionId,
      initiativeSlug: review.initiativeSlug,
      verdict: "safe",
      rationale: "Dissent preservation check.",
      evidenceRefs: claimEvidenceRefsForSources(review.sourceMaterials),
      deliberation: candidate,
    });
    const stored = listClaimDecisionEvidenceRefs(review.id);
    expect(stored.some((ref) => ref.includes(dissent))).toBe(true);
    const [receipt] = listClaimDecisionReceipts(review.id);
    expect(receipt.summary).toContain(dissent);
  });

  test("cross-tenant candidates are rejected", () => {
    // Fixture is tenant-keon: accepting for tenant-biostack must refuse.
    expectDeliberationCode(
      () => acceptCandidate(validPayload(), { expectedTenantId: FOREIGN_TENANT }),
      "DELIBERATION_TENANT_MISMATCH",
    );
    // Matching tenant accepts.
    expect(
      acceptCandidate(validPayload(), { expectedTenantId: TENANT }).tenantId,
    ).toBe(TENANT);
    // Retenanted payloads do not leak across the boundary either.
    const moved = validPayload();
    (moved as { tenantId: string }).tenantId = FOREIGN_TENANT;
    expectDeliberationCode(
      () => acceptCandidate(moved, { expectedTenantId: TENANT }),
      "DELIBERATION_TENANT_MISMATCH",
    );
  });
});
