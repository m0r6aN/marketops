"use server";

import { revalidatePath } from "next/cache";

import { getCampaignById } from "@/lib/campaigns";
import {
  listCampaignAudienceCandidates,
  saveCampaignLifecycle,
} from "@/lib/campaigns/lifecycle-repository";
import { validateCampaignLifecycleInput } from "@/lib/campaigns/lifecycle-service";
import type { CampaignLifecycleInput } from "@/lib/campaigns/lifecycle-types";

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
  const validated = validateCampaignLifecycleInput(input, candidateIds);
  const saved = saveCampaignLifecycle(campaignId, validated);

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/campaigns");
  revalidatePath(`/initiatives/${campaign.initiativeSlug}`);
  return saved;
}
