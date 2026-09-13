"use server";
import { requireSessionTenant } from "@/lib/auth/session";

import { revalidatePath } from "next/cache";

import {
  createBrandVoiceGuideline,
  getBrandVoiceGuideline,
  listEligibleBrandVoiceLibrarySources,
  requireRowTenantMatch,
  updateBrandVoiceGuideline,
} from "@/lib/brand-voice/repository";
import {
  createInitialBrandVoiceInput,
  validateBrandVoiceGuidelineInput,
} from "@/lib/brand-voice/service";
import type { BrandVoiceGuidelineInput } from "@/lib/brand-voice/types";
import { getInitiativeBySlug, requireRowTenantMatch as requireInitiativeRowTenant } from "@/lib/initiatives/repository";

function revalidateBrandVoicePaths(initiativeSlug: string) {
  revalidatePath(`/initiatives/${initiativeSlug}`);
  revalidatePath(`/initiatives/${initiativeSlug}/brand-voice`);
  revalidatePath("/campaigns");
}

function eligibleSourceIds(initiativeSlug: string) {
  return new Set(listEligibleBrandVoiceLibrarySources(initiativeSlug).map((source) => source.id));
}

export async function createBrandVoiceVersionAction(
  initiativeSlug: string,
  baseVersionId?: string
) {
  // w2-tenant-wire: session tenant captured; record tenant must match it.
  const sessionTenant = await requireSessionTenant({ action: "create brand voice version" });
  const initiative = getInitiativeBySlug(initiativeSlug);
  if (!initiative) throw new Error("Initiative not found or inactive.");
  requireInitiativeRowTenant(sessionTenant, initiative, "create brand voice version");

  let input = createInitialBrandVoiceInput(initiative);
  if (baseVersionId) {
    const base = getBrandVoiceGuideline(baseVersionId);
    if (!base || base.initiativeSlug !== initiativeSlug) {
      throw new Error("Base version must belong to the current initiative.");
    }
    // w2-tenant-wire: referenced row tenant must match the session tenant.
    requireRowTenantMatch(sessionTenant, base, "create brand voice version");
    input = {
      name: base.name,
      status: "draft",
      sourceMaterials: base.sourceMaterials,
      audienceSummary: base.audienceSummary,
      positioningSummary: base.positioningSummary,
      toneAttributes: base.toneAttributes,
      allowedLanguage: base.allowedLanguage,
      discouragedLanguage: base.discouragedLanguage,
      claimBoundaries: base.claimBoundaries,
      examplePairs: base.examplePairs,
      channelVariations: base.channelVariations,
      notes: `Created from version ${base.versionNumber}. Review all sources and constraints before approval.`,
    };
  }

  const allowedSourceIds = eligibleSourceIds(initiativeSlug);
  for (const source of input.sourceMaterials) {
    if (source.sourceType === "library-entry") allowedSourceIds.add(source.reference);
  }
  const validated = validateBrandVoiceGuidelineInput(input, {
    initiativeSlug,
    eligibleLibraryEntryIds: allowedSourceIds,
  });
  const created = createBrandVoiceGuideline(initiativeSlug, validated);
  revalidateBrandVoicePaths(initiativeSlug);
  return created;
}

export async function saveBrandVoiceGuidelineAction(
  guidelineId: string,
  input: BrandVoiceGuidelineInput
) {
  // w2-tenant-wire: record tenant must match the session tenant.
  const sessionTenant = await requireSessionTenant({ action: "save brand voice guideline" });
  const existing = getBrandVoiceGuideline(guidelineId);
  if (!existing) throw new Error("Brand voice version not found.");
  requireRowTenantMatch(sessionTenant, existing, "save brand voice guideline");
  const initiative = getInitiativeBySlug(existing.initiativeSlug);
  if (!initiative) throw new Error("Initiative not found or inactive.");
  requireInitiativeRowTenant(sessionTenant, initiative, "save brand voice guideline");

  const validated = validateBrandVoiceGuidelineInput(input, {
    initiativeSlug: existing.initiativeSlug,
    eligibleLibraryEntryIds: eligibleSourceIds(existing.initiativeSlug),
  });
  const updated = updateBrandVoiceGuideline(guidelineId, validated);
  revalidateBrandVoicePaths(existing.initiativeSlug);
  return updated;
}
