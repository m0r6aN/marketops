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
  getPersuasionReview,
  recordPersuasionApplyRun,
  requireRowTenantMatch as requirePersuasionRowTenant,
} from "@/lib/persuasion-review/repository";
import {
  assertReviewApplicable,
  buildPersuasionReview,
  createPersuasionRevisionInput,
} from "@/lib/persuasion-review/service";

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

  try {
    const { initiative, voice } = reviewSource(currentSource, tenantCtx);
    const claimFindings = computeContentClaimFindings(initiative, review.suggestedBody, voice);
    assertReviewApplicable(review, currentSource, claimFindings);
    const input = validateContentVersionInput(
      {
        ...createPersuasionRevisionInput(review, claimFindings),
        brandVoiceSnapshot: buildBrandVoiceContext(voice),
      },
      validationContext(review.initiativeSlug, tenantCtx)
    );
    const created = createContentVersion(currentSource.id, input);
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
