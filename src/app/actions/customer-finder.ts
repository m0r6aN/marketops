"use server";
import { requireSessionTenant } from "@/lib/auth/session";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { getInitiativeBySlug } from "@/lib/initiatives";
import {
  requireRowTenantMatch as requireCustomerFinderRowTenant,
} from "@/lib/customer-finder/repository";
import { requireRowTenantMatch as requireInitiativeRowTenant } from "@/lib/initiatives/repository";
import { buildSourceProposals } from "@/lib/customer-finder/sources";
import {
  createDiscoveryCampaignRecord,
  findDiscoveryCampaignByFingerprint,
  getDiscoveryCampaignDetail,
  getDiscoveryCampaignRecord,
  listCandidateRecordsForCampaign,
  purgeAllCustomerFinderData,
  purgeExpiredCustomerFinderData,
  recordCustomerFinderEvent,
  replaceCampaignCandidates,
  saveOutreachDraft,
  saveSourceRun,
  updateCampaignProcessingState,
} from "@/lib/customer-finder/repository";
import {
  buildSubmissionFingerprint,
  buildTargetCustomerSuggestion,
  computeRetentionExpiry,
  dedupeCandidates,
  normalizeText,
  prepareOutreachDraft,
  processSelectedSource,
  toCampaignName,
  toSlug,
  toSourceRun,
} from "@/lib/customer-finder/service";
import type {
  CreateDiscoveryCampaignInput,
  CreateDiscoveryCampaignResult,
  DraftGenerationInput,
  OutreachChannel,
} from "@/lib/customer-finder/types";

const defaultDraftChannels: OutreachChannel[] = ["email", "linkedin", "x", "crm_csv"];

function revalidateCampaignRoutes() {
  revalidatePath("/campaigns");
  revalidatePath("/campaigns/finder");
}

export async function suggestTargetCustomerDescription(input: {
  prompt: string;
  initiativeSlug?: string;
}) {
  const sessionTenant = await requireSessionTenant({ action: "suggest target customer" });
  purgeExpiredCustomerFinderData();
  const initiative = input.initiativeSlug
    ? (getInitiativeBySlug(input.initiativeSlug) ?? undefined)
    : undefined;
  // w2-tenant-wire: referenced initiative row must belong to the session tenant.
  if (initiative) requireInitiativeRowTenant(sessionTenant, initiative, "suggest target customer");
  const suggestion = buildTargetCustomerSuggestion(input.prompt, initiative);

  return {
    ...suggestion,
    suggestedCampaignName: toCampaignName(suggestion.suggestedDescription),
  };
}

export async function getDiscoverySourceChecklist(input: {
  targetDescription: string;
}) {
  await requireSessionTenant({ action: "get discovery source checklist" });
  purgeExpiredCustomerFinderData();
  return buildSourceProposals(input.targetDescription);
}

export async function createDiscoveryCampaign(
  input: CreateDiscoveryCampaignInput
): Promise<CreateDiscoveryCampaignResult> {
  const sessionTenant = await requireSessionTenant({ action: "create discovery campaign" });
  purgeExpiredCustomerFinderData();

  const nowIso = new Date().toISOString();
  const fingerprint = buildSubmissionFingerprint({
    initiativeSlug: input.initiativeSlug,
    prompt: input.originPrompt,
    targetDescription: input.targetDescription,
    selectedSourceIds: input.selectedSourceIds,
    sourceInputs: input.sourceInputs,
    idempotencyKey: input.idempotencyKey,
  });

  const existing = findDiscoveryCampaignByFingerprint(fingerprint);
  if (existing) {
    // w2-tenant-wire: a fingerprint hit in another tenant must not be
    // disclosed — enforce record tenant before returning it.
    requireCustomerFinderRowTenant(sessionTenant, existing, "create discovery campaign");
    return {
      campaignId: existing.id,
      created: false,
      duplicatePrevented: true,
      status: existing.status,
      discoveryStatus: existing.discoveryStatus,
    };
  }

  const initiative = input.initiativeSlug
    ? (getInitiativeBySlug(input.initiativeSlug) ?? undefined)
    : undefined;
  // w2-tenant-wire: referenced initiative row must belong to the session tenant.
  if (initiative) requireInitiativeRowTenant(sessionTenant, initiative, "create discovery campaign");
  const campaignId = randomUUID();
  const campaignName = toCampaignName(input.targetDescription);
  const slug = `${toSlug(input.targetDescription)}-${campaignId.slice(0, 8)}`;
  const retentionExpiresAt = computeRetentionExpiry(nowIso);
  const sourceProposals = buildSourceProposals(input.targetDescription);

  createDiscoveryCampaignRecord({
    id: campaignId,
    slug,
    campaignName,
    initiativeSlug: input.initiativeSlug ?? "workspace-discovery",
    originPrompt: input.originPrompt,
    targetDescription: input.targetDescription,
    normalizedTargetDescription: normalizeText(input.targetDescription),
    requestFingerprint: fingerprint,
    provenance: {
      createdFrom: "customer-finder-copilot",
      selectedSourceIds: input.selectedSourceIds,
      sourceInputsProvided: Object.fromEntries(
        Object.entries(input.sourceInputs).map(([key, value]) => [key, Boolean(value?.trim())])
      ),
      initiativeContext: initiative
        ? {
            slug: initiative.slug,
            name: initiative.name,
            audiences: initiative.primaryAudiences.map((audience) => audience.label),
            claimPosture: initiative.claimPosture,
          }
        : null,
      retentionPolicy: {
        autoDeleteAfterDays: 90,
        workspacePurgeAvailable: true,
      },
      lawfulBasis: "Public business information with provenance recorded for review-only drafting.",
    },
    createdAt: nowIso,
    retentionExpiresAt,
    selectedChannels: defaultDraftChannels,
  });

  recordCustomerFinderEvent({
    campaignId,
    eventType: "campaign-created",
    summary: "Customer discovery campaign created in planning state.",
    detail: {
      targetDescription: input.targetDescription,
      selectedSourceIds: input.selectedSourceIds,
    },
    nowIso,
  });

  updateCampaignProcessingState({
    campaignId,
    discoveryStatus: "processing",
    notes: "Processing selected discovery sources.",
  });

  const collectedCandidates = [] as Parameters<typeof replaceCampaignCandidates>[1];
  let failureCount = 0;
  let completedCount = 0;
  let emptyCount = 0;

  for (const proposal of sourceProposals) {
    const selected = input.selectedSourceIds.includes(proposal.id);
    const sourceRun = toSourceRun({
      sourceId: proposal.id,
      selected,
      rationale: proposal.reason,
      inputText: input.sourceInputs[proposal.id],
    });

    saveSourceRun(campaignId, sourceRun, nowIso);

    if (!selected) {
      continue;
    }

    const result = await processSelectedSource({
      sourceRun,
      targetDescription: input.targetDescription,
      nowIso,
    });

    const completedRun = {
      ...sourceRun,
      processingStatus: result.status,
      resultCount: result.candidates.length,
      errorMessage: result.errorMessage,
      processedAt: nowIso,
    };
    saveSourceRun(campaignId, completedRun, nowIso);

    if (result.status === "completed") {
      completedCount += 1;
      collectedCandidates.push(...result.candidates);
    } else if (result.status === "empty") {
      emptyCount += 1;
    } else if (result.status === "failed" || result.status === "unsupported") {
      failureCount += 1;
    }

    recordCustomerFinderEvent({
      campaignId,
      eventType: `source-${result.status}`,
      summary: `${completedRun.sourceLabel} finished with status ${result.status}.`,
      detail: {
        resultCount: completedRun.resultCount,
        errorMessage: completedRun.errorMessage,
      },
      nowIso,
    });
  }

  const mergedCandidates = dedupeCandidates(collectedCandidates);
  replaceCampaignCandidates(campaignId, mergedCandidates, nowIso);

  const discoveryStatus =
    mergedCandidates.length > 0 && failureCount > 0
      ? "partial"
      : mergedCandidates.length > 0
        ? "completed"
        : failureCount > 0
          ? "failed"
          : emptyCount > 0
            ? "empty"
            : "pending";

  updateCampaignProcessingState({
    campaignId,
    status: "planning",
    discoveryStatus,
    notes:
      mergedCandidates.length > 0
        ? `Discovered ${mergedCandidates.length} deduplicated candidate${mergedCandidates.length === 1 ? "" : "s"}.`
        : "No candidates discovered yet.",
    lastProcessedAt: nowIso,
  });

  recordCustomerFinderEvent({
    campaignId,
    eventType: "campaign-processed",
    summary: "Selected discovery sources were processed.",
    detail: {
      deduplicatedCandidates: mergedCandidates.length,
      completedSources: completedCount,
      failedSources: failureCount,
    },
    nowIso,
  });

  revalidateCampaignRoutes();

  return {
    campaignId,
    created: true,
    duplicatePrevented: false,
    status: "planning",
    discoveryStatus,
  };
}

export async function generateOutreachDrafts(input: DraftGenerationInput) {
  const sessionTenant = await requireSessionTenant({ action: "generate outreach drafts" });
  purgeExpiredCustomerFinderData();

  const campaignDetail = getDiscoveryCampaignDetail(input.campaignId);
  if (!campaignDetail) {
    throw new Error(`Campaign ${input.campaignId} was not found.`);
  }
  // w2-tenant-wire: record tenant must match the session tenant.
  requireCustomerFinderRowTenant(sessionTenant, campaignDetail.campaign, "generate outreach drafts");

  const nowIso = new Date().toISOString();
  const initiative =
    campaignDetail.campaign.initiativeSlug !== "workspace-discovery"
      ? (getInitiativeBySlug(campaignDetail.campaign.initiativeSlug) ?? undefined)
      : undefined;
  // w2-tenant-wire: referenced initiative row must belong to the session tenant.
  if (initiative) requireInitiativeRowTenant(sessionTenant, initiative, "generate outreach drafts");
  const candidates = campaignDetail.candidates.filter((candidate) =>
    input.candidateIds.includes(candidate.id)
  );

  for (const candidate of candidates) {
    for (const channel of input.channels) {
      const draft = prepareOutreachDraft({
        campaignName: campaignDetail.campaign.campaignName,
        targetDescription: campaignDetail.campaign.targetDescription,
        initiativeName: initiative?.name,
        initiativeOneLiner: initiative?.oneLiner,
        candidate,
        channel,
      });

      saveOutreachDraft({
        campaignId: input.campaignId,
        candidateId: candidate.id,
        channel,
        subjectLine: draft.subjectLine,
        messageBody: draft.messageBody,
        approvalStatus: draft.approvalStatus,
        nowIso,
      });
    }
  }

  recordCustomerFinderEvent({
    campaignId: input.campaignId,
    eventType: "drafts-generated",
    summary: "Outreach drafts were generated for selected candidates.",
    detail: {
      candidateCount: candidates.length,
      channels: input.channels,
    },
    nowIso,
  });

  revalidateCampaignRoutes();
  revalidatePath(`/campaigns/${input.campaignId}`);
}

export async function purgeCustomerFinderWorkspace() {
  // w2-tenant-wire: session tenant captured (purge is operator-scoped). On
  // sqlite this clears the single-tenant local workspace; on PG, RLS confines
  // deletes to the session tenant (see 003). Per-row predicates do not apply
  // to a bulk GC path with no row address.
  await requireSessionTenant({ action: "purge customer finder workspace" });
  purgeAllCustomerFinderData();
  revalidateCampaignRoutes();
}

export async function getDiscoveryCampaignForClient(campaignId: string) {
  const sessionTenant = await requireSessionTenant({ action: "get discovery campaign" });
  purgeExpiredCustomerFinderData();
  const detail = getDiscoveryCampaignDetail(campaignId);
  // w2-tenant-wire: record tenant must match the session tenant.
  if (detail) requireCustomerFinderRowTenant(sessionTenant, detail.campaign, "get discovery campaign");
  return detail;
}

export async function getDiscoveryCandidatesForClient(campaignId: string) {
  const sessionTenant = await requireSessionTenant({ action: "get discovery candidates" });
  purgeExpiredCustomerFinderData();
  const campaign = getDiscoveryCampaignRecord(campaignId);
  // w2-tenant-wire: parent campaign tenant must match the session tenant
  // before any candidate rows are disclosed.
  if (campaign) requireCustomerFinderRowTenant(sessionTenant, campaign, "get discovery candidates");
  return listCandidateRecordsForCampaign(campaignId);
}
