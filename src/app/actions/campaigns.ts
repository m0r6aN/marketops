"use server";
import { requireSessionTenant } from "@/lib/auth/session";

import { revalidatePath } from "next/cache";

import { getCampaignById } from "@/lib/campaigns";
import {
    createManagedCampaign,
    getManagedCampaignById,
    requireRowTenantMatch,
    softDeleteManagedCampaign,
    updateDiscoveryCampaignEditableFields,
    updateManagedCampaign,
} from "@/lib/campaigns/repository";
import {
    campaignLaunchReadinessOptions,
    campaignSensitivityOptions,
    campaignStatusOptions,
    type CampaignLaunchReadiness,
    type CampaignSensitivity,
    type CampaignStatus,
    type DiscoveryCampaignEditableInput,
    type ManagedCampaignInput
} from "@/lib/campaigns/types";
import { getInitiativeBySlugAnyStatus } from "@/lib/initiatives/repository";

function assertNonEmpty(value: string, field: string) {
  if (!value.trim()) {
    throw new Error(`${field} is required.`);
  }
}

function assertOneOf<T extends string>(value: string, options: T[], field: string): asserts value is T {
  if (!options.includes(value as T)) {
    throw new Error(`${field} is invalid.`);
  }
}

function assertInitiativeExists(slug: string, tenantCtx?: { sessionTenant: string; action: string }) {
  const initiative = getInitiativeBySlugAnyStatus(slug);
  if (!initiative) {
    throw new Error("Initiative does not exist.");
  }
  // w2-tenant-wire: the parent initiative row's tenant must match the session
  // tenant — no path may rely on session-presence alone.
  if (tenantCtx) {
    requireRowTenantMatch(tenantCtx.sessionTenant, initiative, tenantCtx.action);
  }
}

function normalizeAssetTypes(assetTypes: string[]) {
  const normalized = assetTypes.map((asset) => asset.trim()).filter(Boolean);
  if (normalized.length === 0) {
    throw new Error("At least one asset type is required.");
  }
  return normalized;
}

function revalidateCampaignPaths(id: string, initiativeSlug: string, previousInitiativeSlug?: string) {
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${id}`);
  revalidatePath(`/campaigns/${id}/edit`);
  revalidatePath(`/initiatives/${initiativeSlug}`);
  if (previousInitiativeSlug && previousInitiativeSlug !== initiativeSlug) {
    revalidatePath(`/initiatives/${previousInitiativeSlug}`);
  }
}

function validateManagedInput(input: ManagedCampaignInput, existingId?: string, tenantCtx?: { sessionTenant: string; action: string }): ManagedCampaignInput {
  assertNonEmpty(input.id, "Campaign id");
  if (existingId && input.id !== existingId) {
    throw new Error("Campaign id is immutable.");
  }

  assertNonEmpty(input.name, "Campaign name");
  assertNonEmpty(input.initiativeSlug, "Initiative");
  assertInitiativeExists(input.initiativeSlug, tenantCtx);
  assertNonEmpty(input.goal, "Goal");
  assertNonEmpty(input.channel, "Channel");
  assertNonEmpty(input.audience, "Audience");
  assertNonEmpty(input.primaryCta, "Primary CTA");
  assertNonEmpty(input.currentFocus, "Current focus");
  assertNonEmpty(input.notes, "Notes");

  assertOneOf(input.status, campaignStatusOptions, "Status");
  assertOneOf(input.claimSensitivity, campaignSensitivityOptions, "Claim sensitivity");
  assertOneOf(input.launchReadiness, campaignLaunchReadinessOptions, "Launch readiness");

  return {
    ...input,
    id: input.id.trim(),
    initiativeSlug: input.initiativeSlug.trim(),
    name: input.name.trim(),
    status: input.status as CampaignStatus,
    goal: input.goal.trim(),
    channel: input.channel.trim(),
    audience: input.audience.trim(),
    primaryCta: input.primaryCta.trim(),
    currentFocus: input.currentFocus.trim(),
    assetTypes: normalizeAssetTypes(input.assetTypes),
    claimSensitivity: input.claimSensitivity as CampaignSensitivity,
    launchReadiness: input.launchReadiness as CampaignLaunchReadiness,
    notes: input.notes.trim(),
  };
}

function validateDiscoveryInput(input: DiscoveryCampaignEditableInput, tenantCtx?: { sessionTenant: string; action: string }) {
  assertNonEmpty(input.name, "Campaign name");
  assertNonEmpty(input.initiativeSlug, "Initiative");
  assertInitiativeExists(input.initiativeSlug, tenantCtx);
  assertNonEmpty(input.targetDescription, "Target description");
  assertNonEmpty(input.notes, "Notes");

  return {
    name: input.name.trim(),
    initiativeSlug: input.initiativeSlug.trim(),
    targetDescription: input.targetDescription.trim(),
    notes: input.notes.trim(),
  };
}

export async function createCampaignAction(input: ManagedCampaignInput) {
  const sessionTenant = await requireSessionTenant({ action: "create campaign" });
  const tenantCtx = { sessionTenant, action: "create campaign" };
  const validated = validateManagedInput(input, undefined, tenantCtx);
  const created = createManagedCampaign(validated);
  revalidateCampaignPaths(created.id, created.initiativeSlug);
  return created;
}

export async function updateCampaignAction(
  id: string,
  input: ManagedCampaignInput | DiscoveryCampaignEditableInput
) {
  const sessionTenant = await requireSessionTenant({ action: "update campaign" });
  const tenantCtx = { sessionTenant, action: "update campaign" };
  const existing = getCampaignById(id);
  if (!existing) {
    throw new Error("Campaign not found.");
  }
  // w2-tenant-wire: the campaign's owning initiative must belong to the
  // session tenant (campaign rows resolve tenant via their initiative).
  assertInitiativeExists(existing.initiativeSlug, tenantCtx);

  if (existing.campaignKind === "managed") {
    const validated = validateManagedInput(input as ManagedCampaignInput, id, tenantCtx);
    const updated = updateManagedCampaign(id, validated);
    revalidateCampaignPaths(id, updated.initiativeSlug, existing.initiativeSlug);
    return updated;
  }

  const validatedDiscovery = validateDiscoveryInput(input as DiscoveryCampaignEditableInput, tenantCtx);
  updateDiscoveryCampaignEditableFields(id, validatedDiscovery);
  revalidateCampaignPaths(id, validatedDiscovery.initiativeSlug, existing.initiativeSlug);
}

export async function deleteCampaignAction(id: string) {
  const sessionTenant = await requireSessionTenant({ action: "delete campaign" });
  const tenantCtx = { sessionTenant, action: "delete campaign" };
  const existing = getCampaignById(id);
  if (!existing || existing.campaignKind !== "managed") {
    throw new Error("Only managed campaigns can be deleted from this surface.");
  }
  // w2-tenant-wire: record tenant (via owning initiative) must match session.
  assertInitiativeExists(existing.initiativeSlug, tenantCtx);

  const managed = getManagedCampaignById(id);
  if (!managed) {
    throw new Error("Campaign not found.");
  }
  requireRowTenantMatch(sessionTenant, managed, "delete campaign");

  softDeleteManagedCampaign(id);
  revalidateCampaignPaths(id, managed.initiativeSlug);
}
