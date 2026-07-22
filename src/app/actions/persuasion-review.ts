"use server";

import { revalidatePath } from "next/cache";
import { getCampaignsByInitiativeSlug } from "@/lib/campaigns";
import { getBrandVoiceGuideline, listApprovedBrandVoiceVersions } from "@/lib/brand-voice/repository";
import { buildBrandVoiceContext, isEligibleBrandVoiceLibraryEntry } from "@/lib/brand-voice/service";
import { createContentVersion, getContentVersion } from "@/lib/content-workspace/repository";
import { computeContentClaimFindings, validateContentVersionInput } from "@/lib/content-workspace/service";
import type { ContentVersionRecord } from "@/lib/content-workspace/types";
import { getInitiativeBySlug } from "@/lib/initiatives/repository";
import { listLibraryEntries } from "@/lib/library/repository";
import {
  createPersuasionReview,
  getPersuasionReview,
  recordPersuasionApplyRun,
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

function validationContext(slug: string) {
  return {
    initiativeSlug: slug,
    libraryEntryIds: new Set(
      listLibraryEntries({ initiativeSlug: slug })
        .filter(isEligibleBrandVoiceLibraryEntry)
        .map((entry) => entry.id)
    ),
    campaignIds: new Set(getCampaignsByInitiativeSlug(slug).map((campaign) => campaign.id)),
    brandVoiceGuidelineIds: new Set(
      listApprovedBrandVoiceVersions(slug, true).map((voice) => voice.id)
    ),
  };
}

function reviewSource(version: ContentVersionRecord) {
  const initiative = getInitiativeBySlug(version.initiativeSlug);
  if (!initiative) throw new Error("Initiative not found or inactive.");
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
  const version = getContentVersion(contentVersionId);
  if (!version) throw new Error("Content version not found.");
  const { claimFindings } = reviewSource(version);
  const review = createPersuasionReview(buildPersuasionReview(version, claimFindings));
  paths(version.initiativeSlug);
  return review;
}

export async function applyPersuasionReviewAction(reviewId: string) {
  const review = getPersuasionReview(reviewId);
  if (!review) throw new Error("Persuasion review not found.");
  const currentSource = getContentVersion(review.contentVersionId);
  if (!currentSource) throw new Error("Source content version not found.");

  try {
    const { initiative, voice } = reviewSource(currentSource);
    const claimFindings = computeContentClaimFindings(initiative, review.suggestedBody, voice);
    assertReviewApplicable(review, currentSource, claimFindings);
    const input = validateContentVersionInput(
      {
        ...createPersuasionRevisionInput(review, claimFindings),
        brandVoiceSnapshot: buildBrandVoiceContext(voice),
      },
      validationContext(review.initiativeSlug)
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
