import { listManagedCampaigns } from "@/lib/campaigns/repository";
import type { Campaign, CampaignMetrics } from "@/lib/campaigns/types";
import { listCandidateRecordsForCampaign, listDiscoveryCampaigns } from "@/lib/customer-finder/repository";

export type {
  Campaign,
  CampaignKind,
  CampaignLaunchReadiness,
  CampaignSensitivity,
  CampaignStatus,
  DiscoveryCampaignEditableInput,
  ManagedCampaignInput,
  ManagedCampaignRecord
} from "@/lib/campaigns/types";

function mapDiscoveryCampaignToViewModel(): Campaign[] {
  return listDiscoveryCampaigns().map((campaign) => ({
    id: campaign.id,
    initiativeSlug: campaign.initiativeSlug,
    name: campaign.campaignName,
    status: campaign.status as Campaign["status"],
    goal: `Identify and verify prospective customers for ${campaign.targetDescription}.`,
    channel: "customer discovery / planning",
    audience: campaign.targetDescription,
    primaryCta: "Review candidates",
    currentFocus:
      campaign.discoveryStatus === "completed"
        ? "Candidate review"
        : campaign.discoveryStatus === "partial"
          ? "Partial discovery review"
          : "Discovery planning",
    assetTypes: ["source plan", "candidate records", "review-required drafts"],
    claimSensitivity: "high",
    launchReadiness: campaign.discoveryStatus === "completed" ? "review-ready" : "planning",
    notes:
      campaign.notes ||
      "Discovery records preserve provenance and require human review before any external outreach.",
    campaignKind: "customer-discovery",
    createdAt: campaign.createdAt,
    targetDescription: campaign.targetDescription,
    discoveryStatus: campaign.discoveryStatus,
    candidateCount: listCandidateRecordsForCampaign(campaign.id).length,
  }));
}

function mapManagedCampaignToViewModel(): Campaign[] {
  return listManagedCampaigns().map((campaign) => ({
    id: campaign.id,
    initiativeSlug: campaign.initiativeSlug,
    name: campaign.name,
    status: campaign.status,
    goal: campaign.goal,
    channel: campaign.channel,
    audience: campaign.audience,
    primaryCta: campaign.primaryCta,
    currentFocus: campaign.currentFocus,
    assetTypes: campaign.assetTypes,
    claimSensitivity: campaign.claimSensitivity,
    launchReadiness: campaign.launchReadiness,
    notes: campaign.notes,
    campaignKind: "managed",
    createdAt: campaign.createdAt,
  }));
}

export function listCampaigns(): Campaign[] {
  return [...mapDiscoveryCampaignToViewModel(), ...mapManagedCampaignToViewModel()];
}

export function getCampaignsByInitiativeSlug(slug: string): Campaign[] {
  return listCampaigns().filter((campaign) => campaign.initiativeSlug === slug);
}

export function getActiveCampaigns(): Campaign[] {
  return listCampaigns().filter((campaign) => campaign.status === "active");
}

export function getCampaignById(id: string): Campaign | undefined {
  return listCampaigns().find((campaign) => campaign.id === id);
}

export function getCampaignMetrics(campaigns: Campaign[]): CampaignMetrics {
  return {
    total: campaigns.length,
    active: campaigns.filter((campaign) => campaign.status === "active").length,
    planning: campaigns.filter((campaign) => campaign.status === "planning").length,
    highSensitivity: campaigns.filter((campaign) => campaign.claimSensitivity === "high").length,
  };
}

export const campaignMetrics = getCampaignMetrics(listCampaigns());
