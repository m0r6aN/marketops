import { listDiscoveryCampaigns } from "@/lib/customer-finder/repository";

export type CampaignStatus =
  | "active"
  | "paused"
  | "planning"
  | "discovering"
  | "review-ready"
  | "complete";

export type CampaignSensitivity = "high" | "medium" | "low";

export type CampaignLaunchReadiness = "ready" | "in-progress" | "planning" | "review-ready";

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
  campaignKind?: "fixture" | "customer-discovery";
  createdAt?: string;
  targetDescription?: string;
  discoveryStatus?: string;
  candidateCount?: number;
};

const fixtureCampaigns: Campaign[] = [
  {
    id: "keon-proof-push",
    initiativeSlug: "keon-systems",
    name: "Governed AI Execution Proof Push",
    status: "active",
    goal: "Drive qualified access requests from security, platform, and governance leaders.",
    channel: "website / founder-led / proof content",
    audience: "CISOs, CTOs, platform engineering, regulated enterprise",
    primaryCta: "Request access",
    currentFocus: "Proof-led access building",
    assetTypes: ["proof tour", "access page", "founder post", "executive brief"],
    claimSensitivity: "high",
    launchReadiness: "in-progress",
    notes: "Must stay verifier-bound and avoid proof overclaims.",
    campaignKind: "fixture",
  },
  {
    id: "biostack-alpha-push",
    initiativeSlug: "biostack",
    name: "Alpha Trust and Provider Summary Push",
    status: "active",
    goal: "Increase saved protocol usage and provider-summary engagement.",
    channel: "product-led / educational content",
    audience: "Self-optimizers, providers, wellness operators",
    primaryCta: "Track a protocol",
    currentFocus: "Conversion polish",
    assetTypes: ["product page", "provider summary", "onboarding copy", "founder post"],
    claimSensitivity: "high",
    launchReadiness: "in-progress",
    notes: "Must remain observational and avoid medical claims.",
    campaignKind: "fixture",
  },
  {
    id: "silentapply-waitlist",
    initiativeSlug: "silentapply",
    name: "Waitlist Validation Campaign",
    status: "planning",
    goal: "Validate demand for targeted application workflow automation.",
    channel: "waitlist / founder-led / social",
    audience: "Job seekers, career switchers, laid-off tech workers",
    primaryCta: "Join waitlist",
    currentFocus: "Positioning refinement",
    assetTypes: [
      "landing page",
      "waitlist copy",
      "social post",
      "user interview prompt",
    ],
    claimSensitivity: "medium",
    launchReadiness: "planning",
    notes: "Must avoid guaranteed interview or job outcome claims.",
    campaignKind: "fixture",
  },
  {
    id: "forgepilot-narrative-test",
    initiativeSlug: "forgepilot",
    name: "Builder Workflow Narrative Test",
    status: "planning",
    goal: "Test positioning around product workflow clarity and launch readiness.",
    channel: "founder-led / build-in-public",
    audience: "Indie hackers, technical founders, product builders",
    primaryCta: "Follow build progress",
    currentFocus: "Positioning refinement",
    assetTypes: ["founder post", "landing page section", "product brief"],
    claimSensitivity: "medium",
    launchReadiness: "planning",
    notes: "Must avoid autonomous shipping or guaranteed PMF claims.",
    campaignKind: "fixture",
  },
];

function mapDiscoveryCampaignToViewModel(): Campaign[] {
  return listDiscoveryCampaigns().map((campaign) => ({
    id: campaign.id,
    initiativeSlug: campaign.initiativeSlug,
    name: campaign.campaignName,
    status: campaign.status as CampaignStatus,
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
  }));
}

export function listCampaigns(): Campaign[] {
  return [...mapDiscoveryCampaignToViewModel(), ...fixtureCampaigns];
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

export function getCampaignMetrics(campaigns: Campaign[]) {
  return {
    total: campaigns.length,
    active: campaigns.filter((campaign) => campaign.status === "active").length,
    planning: campaigns.filter((campaign) => campaign.status === "planning").length,
    highSensitivity: campaigns.filter((campaign) => campaign.claimSensitivity === "high").length,
  };
}

export const campaigns = fixtureCampaigns;

export const campaignMetrics = getCampaignMetrics(listCampaigns());
