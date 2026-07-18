export type InitiativeStageKey = "public-proof" | "alpha" | "concept";

export type InitiativeStatusKey =
  | "access-building"
  | "conversion-polish"
  | "early-build";

export type InitiativeStage = {
  key: InitiativeStageKey;
  label: string;
};

export type InitiativeStatus = {
  key: InitiativeStatusKey;
  label: string;
};

export type ClaimRule = {
  text: string;
  rationale?: string;
};

export type AudienceSegment = {
  label: string;
};

export type Initiative = {
  slug: string;
  name: string;
  category: string;
  stage: InitiativeStage;
  status: InitiativeStatus;
  oneLiner: string;
  primaryAudiences: AudienceSegment[];
  primaryCta: string;
  currentMarketingFocus: string;
  allowedClaims: ClaimRule[];
  bannedClaims: ClaimRule[];
  needsProofClaims: ClaimRule[];
  claimPosture: string;
  narrative: string;
  toneNotes: string;
  publicUrl?: string;
  repoUrl?: string;
  needsPositioningReview: boolean;
  isActive: boolean;
};

export type PortfolioMetrics = {
  totalInitiatives: number;
  activeInitiatives: number;
  needsPositioningReviewCount: number;
  launchStageDistribution: Record<InitiativeStageKey, number>;
};

export type InitiativeInput = Initiative;
