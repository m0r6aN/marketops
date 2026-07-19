"use server";

import { revalidatePath } from "next/cache";

import { getCampaignById } from "@/lib/campaigns";
import {
  listCampaignAudienceCandidates,
  saveCampaignLifecycle,
} from "@/lib/campaigns/lifecycle-repository";
import { validateCampaignLifecycleInput } from "@/lib/campaigns/lifecycle-service";
import type { CampaignLifecycleInput } from "@/lib/campaigns/lifecycle-types";
import {
  getBrandVoiceGuideline,
  listApprovedBrandVoiceVersions,
} from "@/lib/brand-voice/repository";
import { buildBrandVoiceContext } from "@/lib/brand-voice/service";

export async function saveCampaignLifecycleAction(
  campaignId: string,
  input: CampaignLifecycleInput
) {
  const campaign = getCampaignById(campaignId);
  if (!campaign || campaign.campaignKind !== "managed") {
    throw new Error("Full campaign lifecycle planning is available only for managed campaigns.");
  }

  const candidateIds = new Set(
    listCampaignAudienceCandidates(campaign.initiativeSlug).map((candidate) => candidate.id)
  );
  const approvedVersions = listApprovedBrandVoiceVersions(campaign.initiativeSlug, true);
  const allowedBrandVoiceIds = new Set(approvedVersions.map((version) => version.id));
  let effectiveInput = input;
  if (input.brandVoiceGuidelineId) {
    const guideline = getBrandVoiceGuideline(input.brandVoiceGuidelineId);
    if (
      !guideline ||
      guideline.initiativeSlug !== campaign.initiativeSlug ||
      (guideline.status !== "approved" && guideline.status !== "superseded")
    ) {
      throw new Error("Brand voice guidelines must be approved versions from the same initiative.");
    }
    effectiveInput = { ...input, brandVoiceSummary: buildBrandVoiceContext(guideline) };
  }
  const validated = validateCampaignLifecycleInput(effectiveInput, candidateIds, allowedBrandVoiceIds);
  const saved = saveCampaignLifecycle(campaignId, validated);

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/campaigns");
  revalidatePath(`/initiatives/${campaign.initiativeSlug}`);
  return saved;
}
