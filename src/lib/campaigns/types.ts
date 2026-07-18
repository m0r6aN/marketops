export type CampaignStatus =
  | "active"
  | "paused"
  | "planning"
  | "discovering"
  | "review-ready"
  | "complete";

export type CampaignSensitivity = "high" | "medium" | "low";

export type CampaignLaunchReadiness = "ready" | "in-progress" | "planning" | "review-ready";

export type CampaignKind = "managed" | "customer-discovery";

export type ManagedCampaignRecord = {
  id: string;
  initiativeSlug: string;
  name: string;
  status: CampaignStatus;
  goal: string;
  channel: string;
  audience: string;
  primaryCta: string;
  currentFocus: string;
  assetTypes: string[];
  claimSensitivity: CampaignSensitivity;
  launchReadiness: CampaignLaunchReadiness;
  notes: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

export type Campaign = {
  id: string;
  initiativeSlug: string;
  name: string;
  status: CampaignStatus;
  goal: string;
  channel: string;
  audience: string;
  primaryCta: string;
  currentFocus: string;
  assetTypes: string[];
  claimSensitivity: CampaignSensitivity;
  launchReadiness: CampaignLaunchReadiness;
  notes: string;
  campaignKind: CampaignKind;
  createdAt?: string;
  targetDescription?: string;
  discoveryStatus?: string;
  candidateCount?: number;
};

export type ManagedCampaignInput = {
  id: string;
  initiativeSlug: string;
  name: string;
  status: CampaignStatus;
  goal: string;
  channel: string;
  audience: string;
  primaryCta: string;
  currentFocus: string;
  assetTypes: string[];
  claimSensitivity: CampaignSensitivity;
  launchReadiness: CampaignLaunchReadiness;
  notes: string;
};

export type DiscoveryCampaignEditableInput = {
  name: string;
  initiativeSlug: string;
  targetDescription: string;
  notes: string;
};

export type CampaignMetrics = {
  total: number;
  active: number;
  planning: number;
  highSensitivity: number;
};

export const campaignStatusOptions: CampaignStatus[] = [
  "active",
  "paused",
  "planning",
  "discovering",
  "review-ready",
  "complete",
];

export const campaignSensitivityOptions: CampaignSensitivity[] = ["high", "medium", "low"];

export const campaignLaunchReadinessOptions: CampaignLaunchReadiness[] = [
  "ready",
  "in-progress",
  "planning",
  "review-ready",
];
