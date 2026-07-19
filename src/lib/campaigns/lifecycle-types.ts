export const campaignReviewStatusOptions = [
  "draft",
  "review-ready",
  "approved",
  "changes-requested",
] as const;

export const campaignExecutionModeOptions = ["manual", "provider-ready"] as const;

export const campaignExecutionStatusOptions = [
  "not-started",
  "in-progress",
  "completed",
  "failed",
] as const;

export type CampaignReviewStatus = (typeof campaignReviewStatusOptions)[number];
export type CampaignExecutionMode = (typeof campaignExecutionModeOptions)[number];
export type CampaignExecutionStatus = (typeof campaignExecutionStatusOptions)[number];

export type CampaignLifecycleInput = {
  brief: string;
  offer: string;
  audienceSegment: string;
  selectedCandidateIds: string[];
  brandVoiceGuidelineId: string;
  brandVoiceSummary: string;
  assetPlan: string[];
  channelPlan: string;
  outreachPlan: string;
  reviewStatus: CampaignReviewStatus;
  executionMode: CampaignExecutionMode;
  executionStatus: CampaignExecutionStatus;
  executionEvidence: string;
  measurementPlan: string;
  primaryMetric: string;
  targetValue: string;
  actualOutcome: string;
  optimizationNotes: string;
  nextIteration: string;
};

export type CampaignLifecycleRecord = CampaignLifecycleInput & {
  campaignId: string;
  createdAt: string;
  updatedAt: string;
};

export type CampaignAudienceCandidate = {
  id: string;
  discoveryCampaignId: string;
  discoveryCampaignName: string;
  displayName: string;
  organizationName?: string;
  verifiedEvidence: string;
  confidenceLabel: "high" | "medium" | "low";
  sourceSummary?: string;
};

export type CampaignLifecycleEvent = {
  id: string;
  campaignId: string;
  eventType: string;
  summary: string;
  detail: Record<string, unknown>;
  recordedAt: string;
};

export type CampaignLifecyclePhaseId =
  | "brief"
  | "audience"
  | "assets"
  | "outreach"
  | "readiness"
  | "execution"
  | "measurement"
  | "optimization";

export type CampaignLifecyclePhase = {
  id: CampaignLifecyclePhaseId;
  label: string;
  complete: boolean;
  explanation: string;
};

export type CampaignLifecycleProgress = {
  completed: number;
  total: number;
  percent: number;
  currentPhase: CampaignLifecyclePhaseId | "complete";
  phases: CampaignLifecyclePhase[];
};

export function createEmptyCampaignLifecycleInput(): CampaignLifecycleInput {
  return {
    brief: "",
    offer: "",
    audienceSegment: "",
    selectedCandidateIds: [],
    brandVoiceGuidelineId: "",
    brandVoiceSummary: "",
    assetPlan: [],
    channelPlan: "",
    outreachPlan: "",
    reviewStatus: "draft",
    executionMode: "manual",
    executionStatus: "not-started",
    executionEvidence: "",
    measurementPlan: "",
    primaryMetric: "",
    targetValue: "",
    actualOutcome: "",
    optimizationNotes: "",
    nextIteration: "",
  };
}
