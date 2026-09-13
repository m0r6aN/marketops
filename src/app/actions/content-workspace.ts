"use server";
import { requireSessionTenant } from "@/lib/auth/session";

import { revalidatePath } from "next/cache";
import { getCampaignsByInitiativeSlug } from "@/lib/campaigns";
import { getBrandVoiceGuideline, listApprovedBrandVoiceVersions, isRowVisibleToTenant as isBrandVoiceRowVisible, requireRowTenantMatch as requireBrandVoiceRowTenant } from "@/lib/brand-voice/repository";
import { buildBrandVoiceContext, isEligibleBrandVoiceLibraryEntry } from "@/lib/brand-voice/service";
import { generateContentDraft } from "@/lib/content-workspace/provider";
import {
  createContentItem,
  createContentVersion,
  contentItemHasSuccessfulGeneration,
  getContentVersion,
  isRowVisibleToTenant as isContentRowVisible,
  recordContentGenerationRun,
  requireRowTenantMatch as requireContentRowTenant,
  updateContentVersion,
} from "@/lib/content-workspace/repository";
import { computeContentClaimFindings, validateContentVersionInput } from "@/lib/content-workspace/service";
import { createEmptyContentVersionInput, type ContentVersionInput } from "@/lib/content-workspace/types";
import { getInitiativeBySlug, requireRowTenantMatch as requireInitiativeRowTenant } from "@/lib/initiatives/repository";
import { listLibraryEntries, isRowVisibleToTenant as isLibraryRowVisible } from "@/lib/library/repository";

function paths(slug: string) {
  revalidatePath(`/initiatives/${slug}`);
  revalidatePath(`/initiatives/${slug}/content`);
}

function context(slug: string, tenantCtx?: { sessionTenant: string; action: string }) {
  const libraryEntries = listLibraryEntries({ initiativeSlug: slug }).filter(
    (entry) => !tenantCtx || isLibraryRowVisible(tenantCtx.sessionTenant, entry),
  );
  const campaigns = getCampaignsByInitiativeSlug(slug).filter(
    (campaign) => !tenantCtx || isContentRowVisible(tenantCtx.sessionTenant, campaign),
  );
  const voices = listApprovedBrandVoiceVersions(slug, true).filter(
    (voice) => !tenantCtx || isBrandVoiceRowVisible(tenantCtx.sessionTenant, voice),
  );
  return {
    initiativeSlug: slug,
    libraryEntryIds: new Set(libraryEntries.filter(isEligibleBrandVoiceLibraryEntry).map((entry) => entry.id)),
    campaignIds: new Set(campaigns.map((campaign) => campaign.id)),
    brandVoiceGuidelineIds: new Set(voices.map((voice) => voice.id)),
  };
}

function serverDerived(input: ContentVersionInput, slug: string, tenantCtx?: { sessionTenant: string; action: string }) {
  const initiative = getInitiativeBySlug(slug);
  if (!initiative) throw new Error("Initiative not found or inactive.");
  // w2-tenant-wire: record tenant must match the session tenant.
  if (tenantCtx) requireInitiativeRowTenant(tenantCtx.sessionTenant, initiative, tenantCtx.action);
  const voice = input.brandVoiceGuidelineId ? getBrandVoiceGuideline(input.brandVoiceGuidelineId) : undefined;
  if (voice && (voice.initiativeSlug !== slug || !["approved", "superseded"].includes(voice.status))) {
    throw new Error("Brand voice guidelines must be approved versions from the same initiative.");
  }
  // w2-tenant-wire: referenced guideline row must belong to the session tenant.
  if (voice && tenantCtx) requireBrandVoiceRowTenant(tenantCtx.sessionTenant, voice, tenantCtx.action);
  return {
    ...input,
    brandVoiceSnapshot: voice ? buildBrandVoiceContext(voice) : "",
    claimFindings: computeContentClaimFindings(initiative, input.body, voice),
  };
}

export async function createContentItemAction(initiativeSlug: string, title: string) {
  const sessionTenant = await requireSessionTenant({ action: "create content item" });
  const tenantCtx = { sessionTenant, action: "create content item" };
  const initiative = getInitiativeBySlug(initiativeSlug);
  if (!initiative) throw new Error("Initiative not found or inactive.");
  requireInitiativeRowTenant(sessionTenant, initiative, "create content item");
  const validated = validateContentVersionInput(createEmptyContentVersionInput(title), context(initiativeSlug, tenantCtx));
  const created = createContentItem(initiativeSlug, validated);
  paths(initiativeSlug);
  return created;
}

export async function createContentVersionAction(baseVersionId: string) {
  const sessionTenant = await requireSessionTenant({ action: "create content version" });
  const tenantCtx = { sessionTenant, action: "create content version" };
  const base = getContentVersion(baseVersionId);
  if (!base) throw new Error("Base content version not found.");
  requireContentRowTenant(sessionTenant, base, "create content version");
  const input: ContentVersionInput = { ...base, status: "draft", notes: `Created from version ${base.versionNumber}.`, claimFindings: [] };
  const validated = validateContentVersionInput(serverDerived(input, base.initiativeSlug, tenantCtx), context(base.initiativeSlug, tenantCtx));
  const created = createContentVersion(baseVersionId, validated);
  paths(base.initiativeSlug);
  return created;
}

export async function saveContentVersionAction(versionId: string, input: ContentVersionInput) {
  const sessionTenant = await requireSessionTenant({ action: "save content version" });
  const tenantCtx = { sessionTenant, action: "save content version" };
  const existing = getContentVersion(versionId);
  if (!existing) throw new Error("Content version not found.");
  requireContentRowTenant(sessionTenant, existing, "save content version");
  if (input.authorship !== "operator-authored" && !contentItemHasSuccessfulGeneration(existing.contentItemId)) {
    throw new Error("AI-assisted or AI-generated authorship requires a recorded successful generation run for this content item.");
  }
  const validated = validateContentVersionInput(serverDerived(input, existing.initiativeSlug, tenantCtx), context(existing.initiativeSlug, tenantCtx));
  const saved = updateContentVersion(versionId, validated);
  paths(existing.initiativeSlug);
  return saved;
}

export async function generateContentDraftAction(versionId: string, input: ContentVersionInput) {
  const sessionTenant = await requireSessionTenant({ action: "generate content draft" });
  const tenantCtx = { sessionTenant, action: "generate content draft" };
  const existing = getContentVersion(versionId);
  if (!existing) throw new Error("Content version not found.");
  requireContentRowTenant(sessionTenant, existing, "generate content draft");
  if (["approved", "superseded"].includes(existing.status)) throw new Error("Immutable content versions cannot be regenerated.");
  const derived = serverDerived({ ...input, status: existing.status }, existing.initiativeSlug, tenantCtx);
  const validated = validateContentVersionInput(derived, context(existing.initiativeSlug, tenantCtx));
  if (!validated.brandVoiceGuidelineId || !validated.sourceMaterials.length || !validated.objective || !validated.audience || !validated.channel || !validated.format) {
    throw new Error("Generation requires an approved brand voice, provenance, objective, audience, channel, and format.");
  }
  const entries = listLibraryEntries({ initiativeSlug: existing.initiativeSlug }).filter((entry) =>
    isLibraryRowVisible(sessionTenant, entry),
  );
  const campaigns = getCampaignsByInitiativeSlug(existing.initiativeSlug).filter((campaign) =>
    isContentRowVisible(sessionTenant, campaign),
  );
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
