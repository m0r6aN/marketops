import {
  campaignExecutionModeOptions,
  campaignExecutionStatusOptions,
  campaignReviewStatusOptions,
  type CampaignLifecycleInput,
  type CampaignLifecyclePhase,
  type CampaignLifecycleProgress,
} from "@/lib/campaigns/lifecycle-types";

const MAX_TEXT_LENGTH = 20_000;
const MAX_LIST_ITEMS = 100;

function assertOption<T extends string>(value: string, options: readonly T[], field: string): asserts value is T {
  if (!options.includes(value as T)) {
    throw new Error(`${field} is invalid.`);
  }
}

function normalizeText(value: string, field: string) {
  const normalized = value.trim();
  if (normalized.length > MAX_TEXT_LENGTH) {
    throw new Error(`${field} exceeds ${MAX_TEXT_LENGTH.toLocaleString()} characters.`);
  }
  return normalized;
}

function normalizeList(values: string[], field: string) {
  const normalized = Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
  if (normalized.length > MAX_LIST_ITEMS) {
    throw new Error(`${field} cannot contain more than ${MAX_LIST_ITEMS} items.`);
  }
  for (const value of normalized) {
    normalizeText(value, field);
  }
  return normalized;
}

export function validateCampaignLifecycleInput(
  input: CampaignLifecycleInput,
  allowedCandidateIds: ReadonlySet<string>
): CampaignLifecycleInput {
  assertOption(input.reviewStatus, campaignReviewStatusOptions, "Review status");
  assertOption(input.executionMode, campaignExecutionModeOptions, "Execution mode");
  assertOption(input.executionStatus, campaignExecutionStatusOptions, "Execution status");

  const selectedCandidateIds = normalizeList(input.selectedCandidateIds, "Selected candidates");
  const unavailableCandidate = selectedCandidateIds.find((candidateId) => !allowedCandidateIds.has(candidateId));
  if (unavailableCandidate) {
    throw new Error("Selected candidates must belong to the same initiative and remain available for review.");
  }

  if (input.executionMode === "provider-ready" && input.executionStatus !== "not-started") {
    throw new Error(
      "Provider-ready campaigns cannot claim execution until a real provider adapter confirms the action."
    );
  }

  const executionEvidence = normalizeText(input.executionEvidence, "Execution evidence");
  if (
    input.executionMode === "manual" &&
    (input.executionStatus === "completed" || input.executionStatus === "failed") &&
    !executionEvidence
  ) {
    throw new Error("Manual completed or failed execution requires an operator evidence note.");
  }

  return {
    brief: normalizeText(input.brief, "Campaign brief"),
    offer: normalizeText(input.offer, "Offer"),
    audienceSegment: normalizeText(input.audienceSegment, "Audience segment"),
    selectedCandidateIds,
    brandVoiceSummary: normalizeText(input.brandVoiceSummary, "Brand voice summary"),
    assetPlan: normalizeList(input.assetPlan, "Asset plan"),
    channelPlan: normalizeText(input.channelPlan, "Channel plan"),
    outreachPlan: normalizeText(input.outreachPlan, "Outreach plan"),
    reviewStatus: input.reviewStatus,
    executionMode: input.executionMode,
    executionStatus: input.executionStatus,
    executionEvidence,
    measurementPlan: normalizeText(input.measurementPlan, "Measurement plan"),
    primaryMetric: normalizeText(input.primaryMetric, "Primary metric"),
    targetValue: normalizeText(input.targetValue, "Target value"),
    actualOutcome: normalizeText(input.actualOutcome, "Actual outcome"),
    optimizationNotes: normalizeText(input.optimizationNotes, "Optimization notes"),
    nextIteration: normalizeText(input.nextIteration, "Next iteration"),
  };
}

export function computeCampaignLifecycleProgress(
  input: CampaignLifecycleInput
): CampaignLifecycleProgress {
  const has = (value: string) => value.trim().length > 0;
  const phases: CampaignLifecyclePhase[] = [
    {
      id: "brief",
      label: "Brief and offer",
      complete: has(input.brief) && has(input.offer),
      explanation: "Define the objective, offer, and reason this campaign should exist.",
    },
    {
      id: "audience",
      label: "Audience",
      complete: has(input.audienceSegment),
      explanation: "Name the target segment and attach verified Customer Finder candidates when available.",
    },
    {
      id: "assets",
      label: "Assets and voice",
      complete: has(input.brandVoiceSummary) && input.assetPlan.length > 0,
      explanation: "Record interim voice constraints and the assets the campaign needs.",
    },
    {
      id: "outreach",
      label: "Channel and outreach plan",
      complete: has(input.channelPlan) && has(input.outreachPlan),
      explanation: "Plan distribution and outreach without implying delivery occurred.",
    },
    {
      id: "readiness",
      label: "Review readiness",
      complete: input.reviewStatus === "approved",
      explanation: "An operator records approval before execution begins.",
    },
    {
      id: "execution",
      label: "Execution",
      complete: input.executionStatus === "completed" && has(input.executionEvidence),
      explanation: "Only operator-recorded manual execution can complete until an adapter is connected.",
    },
    {
      id: "measurement",
      label: "Measurement",
      complete:
        has(input.measurementPlan) &&
        has(input.primaryMetric) &&
        has(input.targetValue) &&
        has(input.actualOutcome),
      explanation: "Define the metric and target, then record the observed outcome.",
    },
    {
      id: "optimization",
      label: "Optimization",
      complete: has(input.optimizationNotes) && has(input.nextIteration),
      explanation: "Capture what was learned and what changes in the next iteration.",
    },
  ];

  const completed = phases.filter((phase) => phase.complete).length;
  return {
    completed,
    total: phases.length,
    percent: Math.round((completed / phases.length) * 100),
    currentPhase: phases.find((phase) => !phase.complete)?.id ?? "complete",
    phases,
  };
}
