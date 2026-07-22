"use server";

import { revalidatePath } from "next/cache";
import { getCampaignsByInitiativeSlug } from "@/lib/campaigns";
import { getBrandVoiceGuideline, listApprovedBrandVoiceVersions } from "@/lib/brand-voice/repository";
import { buildBrandVoiceContext, isEligibleBrandVoiceLibraryEntry } from "@/lib/brand-voice/service";
import { generateContentDraft } from "@/lib/content-workspace/provider";
import {
  createContentItem,
  createContentVersion,
  contentItemHasSuccessfulGeneration,
  getContentVersion,
  recordContentGenerationRun,
  updateContentVersion,
} from "@/lib/content-workspace/repository";
import { computeContentClaimFindings, validateContentVersionInput } from "@/lib/content-workspace/service";
import { createEmptyContentVersionInput, type ContentVersionInput } from "@/lib/content-workspace/types";
import { getInitiativeBySlug } from "@/lib/initiatives/repository";
import { listLibraryEntries } from "@/lib/library/repository";

function paths(slug: string) {
  revalidatePath(`/initiatives/${slug}`);
  revalidatePath(`/initiatives/${slug}/content`);
}

function context(slug: string) {
  return {
    initiativeSlug: slug,
    libraryEntryIds: new Set(listLibraryEntries({ initiativeSlug: slug }).filter(isEligibleBrandVoiceLibraryEntry).map((entry) => entry.id)),
    campaignIds: new Set(getCampaignsByInitiativeSlug(slug).map((campaign) => campaign.id)),
    brandVoiceGuidelineIds: new Set(listApprovedBrandVoiceVersions(slug, true).map((voice) => voice.id)),
  };
}

function serverDerived(input: ContentVersionInput, slug: string) {
  const initiative = getInitiativeBySlug(slug);
  if (!initiative) throw new Error("Initiative not found or inactive.");
  const voice = input.brandVoiceGuidelineId ? getBrandVoiceGuideline(input.brandVoiceGuidelineId) : undefined;
  if (voice && (voice.initiativeSlug !== slug || !["approved", "superseded"].includes(voice.status))) {
    throw new Error("Brand voice guidelines must be approved versions from the same initiative.");
  }
  return {
    ...input,
    brandVoiceSnapshot: voice ? buildBrandVoiceContext(voice) : "",
    claimFindings: computeContentClaimFindings(initiative, input.body, voice),
  };
}

export async function createContentItemAction(initiativeSlug: string, title: string) {
  if (!getInitiativeBySlug(initiativeSlug)) throw new Error("Initiative not found or inactive.");
  const validated = validateContentVersionInput(createEmptyContentVersionInput(title), context(initiativeSlug));
  const created = createContentItem(initiativeSlug, validated);
  paths(initiativeSlug);
  return created;
}

export async function createContentVersionAction(baseVersionId: string) {
  const base = getContentVersion(baseVersionId);
  if (!base) throw new Error("Base content version not found.");
  const input: ContentVersionInput = { ...base, status: "draft", notes: `Created from version ${base.versionNumber}.`, claimFindings: [] };
  const validated = validateContentVersionInput(serverDerived(input, base.initiativeSlug), context(base.initiativeSlug));
  const created = createContentVersion(baseVersionId, validated);
  paths(base.initiativeSlug);
  return created;
}

export async function saveContentVersionAction(versionId: string, input: ContentVersionInput) {
  const existing = getContentVersion(versionId);
  if (!existing) throw new Error("Content version not found.");
  if (input.authorship !== "operator-authored" && !contentItemHasSuccessfulGeneration(existing.contentItemId)) {
    throw new Error("AI-assisted or AI-generated authorship requires a recorded successful generation run for this content item.");
  }
  const validated = validateContentVersionInput(serverDerived(input, existing.initiativeSlug), context(existing.initiativeSlug));
  const saved = updateContentVersion(versionId, validated);
  paths(existing.initiativeSlug);
  return saved;
}

export async function generateContentDraftAction(versionId: string, input: ContentVersionInput) {
  const existing = getContentVersion(versionId);
  if (!existing) throw new Error("Content version not found.");
  if (["approved", "superseded"].includes(existing.status)) throw new Error("Immutable content versions cannot be regenerated.");
  const derived = serverDerived({ ...input, status: existing.status }, existing.initiativeSlug);
  const validated = validateContentVersionInput(derived, context(existing.initiativeSlug));
  if (!validated.brandVoiceGuidelineId || !validated.sourceMaterials.length || !validated.objective || !validated.audience || !validated.channel || !validated.format) {
    throw new Error("Generation requires an approved brand voice, provenance, objective, audience, channel, and format.");
  }
  const entries = listLibraryEntries({ initiativeSlug: existing.initiativeSlug });
  const campaigns = getCampaignsByInitiativeSlug(existing.initiativeSlug);
  const sourceContext = validated.sourceMaterials.map((source) => {
    if (source.sourceType === "library-entry") {
      const entry = entries.find((item) => item.id === source.reference);
      return { label: source.label, content: entry?.content ?? source.evidenceNote };
    }
    if (source.sourceType === "campaign") {
      const campaign = campaigns.find((item) => item.id === source.reference);
      return { label: source.label, content: campaign ? `${campaign.name}\n${campaign.goal}\n${campaign.audience}\n${campaign.primaryCta}` : source.evidenceNote };
    }
    return { label: source.label, content: source.evidenceNote };
  });
  const result = await generateContentDraft(validated, sourceContext);
  const run = recordContentGenerationRun(existing, result);
  let version = existing;
  if (result.status === "succeeded") {
    const initiative = getInitiativeBySlug(existing.initiativeSlug)!;
    const voice = getBrandVoiceGuideline(validated.brandVoiceGuidelineId);
    version = updateContentVersion(versionId, {
      ...validated,
      body: result.resultText,
      authorship: "ai-generated",
      claimFindings: computeContentClaimFindings(initiative, result.resultText, voice),
    });
  }
  paths(existing.initiativeSlug);
  return { run, version };
}
