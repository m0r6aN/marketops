export type DiscoverySourceId =
  | "manual_csv"
  | "company_websites"
  | "github"
  | "linkedin_public"
  | "x_public"
  | "business_directories";

export type DiscoverySourceSupportLevel = "supported" | "conditional" | "unsupported";

export type DiscoverySourceProcessingStatus =
  | "pending"
  | "processing"
  | "completed"
  | "empty"
  | "failed"
  | "unsupported";

export type DiscoveryCandidateKind = "person" | "organization";

export type DiscoveryConfidenceLabel = "high" | "medium" | "low";

export type OutreachChannel = "email" | "linkedin" | "x" | "crm_csv";

export type DiscoverySourceDefinition = {
  id: DiscoverySourceId;
  label: string;
  explanation: string;
  supportLevel: DiscoverySourceSupportLevel;
  availabilityNote?: string;
  requiresSeedInput: boolean;
  inputLabel?: string;
  inputPlaceholder?: string;
  supportsAutomaticSearch: boolean;
};

export type DiscoverySourceProposal = DiscoverySourceDefinition & {
  reason: string;
  selectedByDefault: boolean;
  relevanceScore: number;
};

export type TargetCustomerSuggestion = {
  suggestedDescription: string;
  rationale: string[];
};

export type DiscoverySourceRun = {
  sourceId: DiscoverySourceId;
  sourceLabel: string;
  supportLevel: DiscoverySourceSupportLevel;
  selected: boolean;
  processingStatus: DiscoverySourceProcessingStatus;
  rationale: string;
  availabilityNote?: string;
  inputText?: string;
  resultCount: number;
  errorMessage?: string;
  processedAt?: string;
};

export type CandidateProvenance = {
  sourceId: DiscoverySourceId;
  sourceLabel: string;
  sourceUrl?: string;
  reason: string;
  evidenceText: string;
  confidenceScore: number;
  contactChannel?: string;
  contactValue?: string;
  discoveredAt: string;
};

export type DiscoveredCandidate = {
  candidateKind: DiscoveryCandidateKind;
  displayName: string;
  organizationName?: string;
  matchReason: string;
  verifiedEvidence: string;
  confidenceLabel: DiscoveryConfidenceLabel;
  confidenceScore: number;
  sourceSummary?: string;
  contactChannel?: string;
  contactValue?: string;
  inferredNotes?: string;
  discoveryTimestamp: string;
  provenance: CandidateProvenance[];
};

export type DiscoveryCampaignRecord = {
  id: string;
  slug: string;
  campaignName: string;
  initiativeSlug: string;
  originPrompt: string;
  targetDescription: string;
  normalizedTargetDescription: string;
  status: string;
  discoveryStatus: string;
  selectedChannels: OutreachChannel[];
  requestFingerprint: string;
  provenance: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  retentionExpiresAt: string;
  lastProcessedAt?: string;
  notes?: string;
};

export type DiscoveryCampaignDetail = {
  campaign: DiscoveryCampaignRecord;
  sourceRuns: DiscoverySourceRun[];
  candidates: Array<
    DiscoveredCandidate & {
      id: string;
      dedupeKey: string;
      factualStatus: "verified";
    }
  >;
  drafts: OutreachDraftRecord[];
};

export type OutreachDraftRecord = {
  id: string;
  campaignId: string;
  candidateId: string;
  channel: OutreachChannel;
  subjectLine?: string;
  messageBody: string;
  approvalStatus: "review-required" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
};

export type CreateDiscoveryCampaignInput = {
  initiativeSlug?: string;
  originPrompt: string;
  targetDescription: string;
  selectedSourceIds: DiscoverySourceId[];
  sourceInputs: Partial<Record<DiscoverySourceId, string>>;
  idempotencyKey: string;
};

export type CreateDiscoveryCampaignResult = {
  campaignId: string;
  created: boolean;
  duplicatePrevented: boolean;
  status: string;
  discoveryStatus: string;
};

export type DraftGenerationInput = {
  campaignId: string;
  candidateIds: string[];
  channels: OutreachChannel[];
};
