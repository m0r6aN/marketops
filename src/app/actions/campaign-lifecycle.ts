"use server";
import { requireSessionTenant } from "@/lib/auth/session";

import { revalidatePath } from "next/cache";

import { getCampaignById } from "@/lib/campaigns";
import {
  listCampaignAudienceCandidates,
  saveCampaignLifecycle,
} from "@/lib/campaigns/lifecycle-repository";
import { getInitiativeBySlugAnyStatus, requireRowTenantMatch } from "@/lib/initiatives/repository";
import { validateCampaignLifecycleInput } from "@/lib/campaigns/lifecycle-service";
import type { CampaignLifecycleInput } from "@/lib/campaigns/lifecycle-types";
import {
  getBrandVoiceGuideline,
  listApprovedBrandVoiceVersions,
  requireRowTenantMatch as requireBrandVoiceRowTenant,
} from "@/lib/brand-voice/repository";
import { buildBrandVoiceContext } from "@/lib/brand-voice/service";

export async function saveCampaignLifecycleAction(
  campaignId: string,
  input: CampaignLifecycleInput
) {
  const sessionTenant = await requireSessionTenant({ action: "save campaign lifecycle" });
  const campaign = getCampaignById(campaignId);
  if (!campaign || campaign.campaignKind !== "managed") {
    throw new Error("Full campaign lifecycle planning is available only for managed campaigns.");
  }
  // w2-tenant-wire: record tenant (via owning initiative) must match session.
  const initiative = getInitiativeBySlugAnyStatus(campaign.initiativeSlug);
  if (!initiative) {
    throw new Error("Initiative does not exist.");
  }
  requireRowTenantMatch(sessionTenant, initiative, "save campaign lifecycle");

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
    // w2-tenant-wire: referenced guideline row must belong to the session tenant.
    requireBrandVoiceRowTenant(sessionTenant, guideline, "save campaign lifecycle");
    effectiveInput = { ...input, brandVoiceSummary: buildBrandVoiceContext(guideline) };
  }
  const validated = validateCampaignLifecycleInput(effectiveInput, candidateIds, allowedBrandVoiceIds);
  const saved = saveCampaignLifecycle(campaignId, validated);

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/campaigns");
  revalidatePath(`/initiatives/${campaign.initiativeSlug}`);
  return saved;
}
