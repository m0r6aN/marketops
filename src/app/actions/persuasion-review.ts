"use server";
import { requireSessionTenant } from "@/lib/auth/session";
import { enforceEntitlement } from "@/lib/entitlements/gate";

import { revalidatePath } from "next/cache";
import { getCampaignsByInitiativeSlug } from "@/lib/campaigns";
import { getBrandVoiceGuideline, listApprovedBrandVoiceVersions, isRowVisibleToTenant as isBrandVoiceRowVisible, requireRowTenantMatch as requireBrandVoiceRowTenant } from "@/lib/brand-voice/repository";
import { buildBrandVoiceContext, isEligibleBrandVoiceLibraryEntry } from "@/lib/brand-voice/service";
import { createContentVersion, getContentVersion, isRowVisibleToTenant as isContentRowVisible, requireRowTenantMatch as requireContentRowTenant } from "@/lib/content-workspace/repository";
import { computeContentClaimFindings, validateContentVersionInput } from "@/lib/content-workspace/service";
import type { ContentVersionRecord } from "@/lib/content-workspace/types";
import { getInitiativeBySlug, requireRowTenantMatch as requireInitiativeRowTenant } from "@/lib/initiatives/repository";
import { listLibraryEntries, isRowVisibleToTenant as isLibraryRowVisible } from "@/lib/library/repository";
import {
  createPersuasionReview,
  getLatestClaimApprovalForReview,
  getPersuasionReview,
  hasApprovedClaimApproval,
  listClaimDecisionReceipts,
  recordClaimApproval,
  recordClaimDecisionReceipt,
  recordPersuasionApplyRun,
  requireRowTenantMatch as requirePersuasionRowTenant,
} from "@/lib/persuasion-review/repository";
import { CLAIM_POLICY_VERSION } from "@/lib/claims/policy";
import {
  assertReviewApplicable,
  buildPersuasionReview,
  ClaimGateError,
  claimEvidenceRefsForSources,
  createPersuasionRevisionInput,
  decideClaimApply,
  deriveReviewClaimVerdict,
  rationaleForReviewClaimVerdict,
} from "@/lib/persuasion-review/service";
import type { ApprovalState } from "@/lib/marketops/entities";
import type { ClaimDecisionVerdict } from "@/lib/persuasion-review/types";

function paths(slug: string) {
  revalidatePath(`/initiatives/${slug}`);
  revalidatePath(`/initiatives/${slug}/content`);
  revalidatePath(`/initiatives/${slug}/persuasion`);
}

function validationContext(slug: string, tenantCtx?: { sessionTenant: string; action: string }) {
  return {
    initiativeSlug: slug,
    libraryEntryIds: new Set(
      listLibraryEntries({ initiativeSlug: slug })
        .filter((entry) => !tenantCtx || isLibraryRowVisible(tenantCtx.sessionTenant, entry))
        .filter(isEligibleBrandVoiceLibraryEntry)
        .map((entry) => entry.id)
    ),
    campaignIds: new Set(
      getCampaignsByInitiativeSlug(slug)
        .filter((campaign) => !tenantCtx || isContentRowVisible(tenantCtx.sessionTenant, campaign))
        .map((campaign) => campaign.id),
    ),
    brandVoiceGuidelineIds: new Set(
      listApprovedBrandVoiceVersions(slug, true)
        .filter((voice) => !tenantCtx || isBrandVoiceRowVisible(tenantCtx.sessionTenant, voice))
        .map((voice) => voice.id)
    ),
  };
}

function reviewSource(version: ContentVersionRecord, tenantCtx?: { sessionTenant: string; action: string }) {
  const initiative = getInitiativeBySlug(version.initiativeSlug);
  if (!initiative) throw new Error("Initiative not found or inactive.");
  // w2-tenant-wire: record tenant must match the session tenant.
  if (tenantCtx) requireInitiativeRowTenant(tenantCtx.sessionTenant, initiative, tenantCtx.action);
  if (tenantCtx) requireContentRowTenant(tenantCtx.sessionTenant, version, tenantCtx.action);
  if (!version.body.trim()) throw new Error("Content must have a body before persuasion review.");
  if (!version.sourceMaterials.length) {
    throw new Error("Content must retain at least one provenance source before persuasion review.");
  }
  const voice = version.brandVoiceGuidelineId
    ? getBrandVoiceGuideline(version.brandVoiceGuidelineId)
    : undefined;
  if (!voice || voice.initiativeSlug !== version.initiativeSlug || !["approved", "superseded"].includes(voice.status)) {
    throw new Error("Persuasion review requires an approved brand voice version from the same initiative.");
  }
  // w2-tenant-wire: referenced guideline row must belong to the session tenant.
  if (tenantCtx) requireBrandVoiceRowTenant(tenantCtx.sessionTenant, voice, tenantCtx.action);
  if (version.brandVoiceSnapshot !== buildBrandVoiceContext(voice)) {
    throw new Error("The content brand voice snapshot is inconsistent. Save a fresh content version before review.");
  }
  return {
    initiative,
    voice,
    claimFindings: computeContentClaimFindings(initiative, version.body, voice),
  };
}

export async function createPersuasionReviewAction(contentVersionId: string) {
  const sessionTenant = await requireSessionTenant({ action: "create persuasion review" });
  const tenantCtx = { sessionTenant, action: "create persuasion review" };
  const version = getContentVersion(contentVersionId);
  if (!version) throw new Error("Content version not found.");
  requireContentRowTenant(sessionTenant, version, "create persuasion review");
  // w2-billing-wire: claim-review entitlement gate (lapsed/cancelled tenants
  // deny with ENTITLEMENT_INACTIVE). Tenant checks above keep precedence.
  enforceEntitlement(sessionTenant, "claim-review", "create persuasion review");
  const { claimFindings } = reviewSource(version, tenantCtx);
  const review = createPersuasionReview(buildPersuasionReview(version, claimFindings));
  // w2-claim-approval-wire: every review creation records the strict policy
  // verdict as a decision receipt (fail-closed: a receipt-write failure fails
  // the creation rather than leaving an ungated review).
  recordClaimDecisionReceipt({
    reviewId: review.id,
    contentVersionId: review.contentVersionId,
    initiativeSlug: review.initiativeSlug,
    verdict: deriveReviewClaimVerdict(review),
    rationale: rationaleForReviewClaimVerdict(review),
    evidenceRefs: claimEvidenceRefsForSources(review.sourceMaterials),
  });
  paths(version.initiativeSlug);
  return review;
}

export async function applyPersuasionReviewAction(reviewId: string) {
  const sessionTenant = await requireSessionTenant({ action: "apply persuasion review" });
  const tenantCtx = { sessionTenant, action: "apply persuasion review" };
  const review = getPersuasionReview(reviewId);
  if (!review) throw new Error("Persuasion review not found.");
  requirePersuasionRowTenant(sessionTenant, review, "apply persuasion review");
  const currentSource = getContentVersion(review.contentVersionId);
  if (!currentSource) throw new Error("Source content version not found.");
  requireContentRowTenant(sessionTenant, currentSource, "apply persuasion review");
  // Evidence for the gate = the current source's provenance refs (pure read).
  const evidenceRefs = claimEvidenceRefsForSources(currentSource.sourceMaterials);

  try {
    const { initiative, voice } = reviewSource(currentSource, tenantCtx);
    const claimFindings = computeContentClaimFindings(initiative, review.suggestedBody, voice);
    // w2-claim-approval-wire: server-side strict gate. The workspace UI
    // disables apply independently, but this refusal is authoritative:
    // blocked → CLAIM_BLOCKED; needs-review without a recorded approved
    // ApprovalState (or without evidence) → APPROVAL_REQUIRED.
    const gate = decideClaimApply({
      review,
      suggestedFindings: claimFindings,
      evidenceRefs,
      hasApproval: hasApprovedClaimApproval(review.id),
    });
    assertReviewApplicable(
      review,
      currentSource,
      claimFindings,
      gate.verdict === "needs-review" ? { approvedNeedsReview: true } : undefined,
    );
    const input = validateContentVersionInput(
      {
        ...createPersuasionRevisionInput(review, claimFindings),
        brandVoiceSnapshot: buildBrandVoiceContext(voice),
      },
      validationContext(review.initiativeSlug, tenantCtx)
    );
    const created = createContentVersion(currentSource.id, input);
    // Approved-apply decision receipt (safe applies record a safe receipt).
    recordClaimDecisionReceipt({
      reviewId: review.id,
      contentVersionId: currentSource.id,
      initiativeSlug: review.initiativeSlug,
      verdict: gate.verdict === "needs-review" ? "approved-apply" : gate.verdict,
      rationale: gate.rationale,
      evidenceRefs,
    });
    recordPersuasionApplyRun({
      persuasionReviewId: review.id,
      sourceContentVersionId: currentSource.id,
      targetContentVersionId: created.id,
      status: "succeeded",
      summary: `Created editable content version ${created.versionNumber} from persuasion review; no publishing action occurred.`,
    });
    paths(review.initiativeSlug);
    return created;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Persuasion revision failed.";
    // Refused decisions also leave a readable receipt (blocked / needs-review).
    try {
      const refusalVerdict = deriveReviewClaimVerdict(review);
      recordClaimDecisionReceipt({
        reviewId: review.id,
        contentVersionId: currentSource.id,
        initiativeSlug: review.initiativeSlug,
        verdict: refusalVerdict,
        rationale: `Apply refused: ${message}`,
        evidenceRefs,
      });
    } catch {
      // Receipt writes are best-effort on the refusal path so the original
      // denial (tenant/entitlement/claim-gate) always surfaces unchanged.
    }
    recordPersuasionApplyRun({
      persuasionReviewId: review.id,
      sourceContentVersionId: currentSource.id,
      status: "failed",
      summary: "Persuasion revision was blocked; source content was not changed.",
      errorMessage: message,
    });
    paths(review.initiativeSlug);
    throw cause;
  }
}

// ── w2-claim-approval-wire: operator approval + gate status ─────────────────
// No new routes/pages: the persuasion workspace calls these actions directly.
// Tenant gates keep #23 precedence; no entitlement change here (deliberately
// not decided in this parcel — see PR open decisions).

/**
 * Record an operator approval (approved ApprovalState) for a needs-review
 * item. Blocked verdicts are refused with CLAIM_BLOCKED — approval can never
 * authorize banned content.
 */
export async function recordClaimApprovalAction(
  reviewId: string,
  notes?: string,
): Promise<ApprovalState> {
  const sessionTenant = await requireSessionTenant({ action: "record claim approval" });
  const review = getPersuasionReview(reviewId);
  if (!review) throw new Error("Persuasion review not found.");
  requirePersuasionRowTenant(sessionTenant, review, "record claim approval");
  const verdict = deriveReviewClaimVerdict(review);
  if (verdict === "blocked") {
    throw new ClaimGateError(
      "CLAIM_BLOCKED",
      `Approval refused: this review carries blocked claim content under ${CLAIM_POLICY_VERSION}; remove the violating claims and create a fresh review.`,
    );
  }
  const approval = recordClaimApproval({
    reviewId: review.id,
    contentVersionId: review.contentVersionId,
    initiativeSlug: review.initiativeSlug,
    requestedBy: sessionTenant,
    requestedByDisplayName: sessionTenant,
    reviewedBy: sessionTenant,
    reviewedByDisplayName: sessionTenant,
    notes: notes?.trim() || "Operator approval recorded from the persuasion workspace.",
  });
  recordClaimDecisionReceipt({
    reviewId: review.id,
    contentVersionId: review.contentVersionId,
    initiativeSlug: review.initiativeSlug,
    verdict,
    rationale: `Operator approval recorded for this review; apply still requires attached evidence plus the apply step. [${CLAIM_POLICY_VERSION}]`,
    evidenceRefs: claimEvidenceRefsForSources(review.sourceMaterials),
  });
  paths(review.initiativeSlug);
  return approval;
}

export type ClaimGateStatus = {
  reviewId: string;
  verdict: ClaimDecisionVerdict;
  policyVersion: typeof CLAIM_POLICY_VERSION;
  rationale: string;
  evidenceRefs: string[];
  hasApproval: boolean;
  approval: ApprovalState | undefined;
  receipts: Array<{
    id: string;
    kind: string;
    summary: string;
    createdAt: string;
  }>;
};

/** Gate status for the workspace approval-required UX (read-only). */
export async function getClaimGateStatusAction(reviewId: string): Promise<ClaimGateStatus> {
  const sessionTenant = await requireSessionTenant({ action: "read claim gate status" });
  const review = getPersuasionReview(reviewId);
  if (!review) throw new Error("Persuasion review not found.");
  requirePersuasionRowTenant(sessionTenant, review, "read claim gate status");
  const approval = getLatestClaimApprovalForReview(review.id);
  return {
    reviewId: review.id,
    verdict: deriveReviewClaimVerdict(review),
    policyVersion: CLAIM_POLICY_VERSION,
    rationale: rationaleForReviewClaimVerdict(review),
    evidenceRefs: claimEvidenceRefsForSources(review.sourceMaterials),
    hasApproval: approval?.decision === "approved",
    approval,
    receipts: listClaimDecisionReceipts(review.id).map((receipt) => ({
      id: receipt.id,
      kind: receipt.kind,
      summary: receipt.summary,
      createdAt: receipt.createdAt ?? "",
    })),
  };
}
