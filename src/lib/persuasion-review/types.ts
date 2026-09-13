import type {
  ContentAuthorship,
  ContentClaimFinding,
  ContentSourceReference,
  ContentStatus,
} from "@/lib/content-workspace/types";

export const persuasionDimensionOptions = [
  "clarity",
  "audience-relevance",
  "credibility",
  "value-framing",
  "objection-handling",
  "cta-strength",
  "channel-fit",
] as const;

export const persuasionIssueTypeOptions = [
  "deceptive-urgency-scarcity",
  "fabricated-social-proof",
  "unsupported-claim",
  "dark-pattern",
  "sensitive-trait-exploitation",
  "discriminatory-targeting",
] as const;

export type PersuasionDimension = (typeof persuasionDimensionOptions)[number];
export type PersuasionIssueType = (typeof persuasionIssueTypeOptions)[number];
export type PersuasionAssessmentStatus = "strong" | "needs-work" | "missing" | "blocked";

export type PersuasionAssessment = {
  id: string;
  dimension: PersuasionDimension;
  principle: string;
  status: PersuasionAssessmentStatus;
  audienceRationale: string;
  beforeText: string;
  suggestedRevision: string;
  evidenceOrAssumption: string;
  ethicalRisk: string;
};

export type PersuasionIssueFlag = {
  id: string;
  type: PersuasionIssueType;
  status: "flagged" | "blocked";
  evidence: string;
  rationale: string;
};

export type PersuasionReviewRecord = {
  id: string;
  initiativeSlug: string;
  contentItemId: string;
  contentVersionId: string;
  contentVersionNumber: number;
  contentStatus: ContentStatus;
  sourceUpdatedAt: string;
  title: string;
  channel: string;
  format: string;
  objective: string;
  audience: string;
  offer: string;
  cta: string;
  campaignId: string;
  body: string;
  suggestedBody: string;
  sourceMaterials: ContentSourceReference[];
  authorship: ContentAuthorship;
  brandVoiceGuidelineId: string;
  brandVoiceSnapshot: string;
  claimFindings: ContentClaimFinding[];
  summary: string;
  assessments: PersuasionAssessment[];
  issueFlags: PersuasionIssueFlag[];
  createdAt: string;
};

export type PersuasionApplyRun = {
  id: string;
  persuasionReviewId: string;
  sourceContentVersionId: string;
  targetContentVersionId?: string;
  status: "succeeded" | "failed";
  summary: string;
  errorMessage: string;
  createdAt: string;
  completedAt: string;
};
export type PersuasionReviewEvent = {
  id: string;
  persuasionReviewId: string;
  initiativeSlug: string;
  contentVersionId: string;
  eventType: string;
  summary: string;
  detail: Record<string, unknown>;
  recordedAt: string;
};

// ── w2-claim-approval-wire: strict claim-gate vocabulary ─────────────────────
// Policy verdicts mirror src/lib/claims/policy.ts (blocked | needs-review |
// safe). Decision receipts additionally record "approved-apply" for an apply
// that proceeded under a recorded operator approval. Denial codes mirror the
// GateResult denial vocabulary (denialCode + failureStage "decision").
export type ClaimPolicyVerdict = "blocked" | "needs-review" | "safe";
export type ClaimDecisionVerdict = ClaimPolicyVerdict | "approved-apply";
export type ClaimGateDenialCode = "CLAIM_BLOCKED" | "APPROVAL_REQUIRED";
