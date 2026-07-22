export const contentStatusOptions = ["draft", "review-ready", "changes-requested", "approved", "superseded"] as const;
export const contentAuthorshipOptions = ["operator-authored", "ai-assisted", "ai-generated"] as const;
export const contentSourceTypeOptions = ["initiative-canon", "library-entry", "campaign", "url", "manual-reference"] as const;

export type ContentStatus = (typeof contentStatusOptions)[number];
export type ContentAuthorship = (typeof contentAuthorshipOptions)[number];
export type ContentSourceType = (typeof contentSourceTypeOptions)[number];
export type ContentGenerationStatus = "succeeded" | "failed" | "unavailable";

export type ContentSourceReference = {
  id: string;
  sourceType: ContentSourceType;
  label: string;
  reference: string;
  evidenceNote: string;
};

export type ContentClaimFinding = {
  id: string;
  handling: "avoid" | "needs-proof";
  statement: string;
  rationale: string;
  origin: "initiative" | "brand-voice";
};

export type ContentVersionInput = {
  title: string;
  status: ContentStatus;
  channel: string;
  format: string;
  objective: string;
  audience: string;
  offer: string;
  cta: string;
  campaignId: string;
  brandVoiceGuidelineId: string;
  brandVoiceSnapshot: string;
  sourceMaterials: ContentSourceReference[];
  body: string;
  authorship: ContentAuthorship;
  claimFindings: ContentClaimFinding[];
  notes: string;
};

export type ContentVersionRecord = ContentVersionInput & {
  id: string;
  contentItemId: string;
  initiativeSlug: string;
  versionNumber: number;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
};

export type ContentGenerationRun = {
  id: string;
  contentVersionId: string;
  status: ContentGenerationStatus;
  provider: string;
  model: string;
  requestSummary: string;
  resultText: string;
  errorMessage: string;
  createdAt: string;
  completedAt: string;
};

export type ContentEvent = {
  id: string;
  contentItemId: string;
  contentVersionId: string;
  initiativeSlug: string;
  eventType: string;
  summary: string;
  detail: Record<string, unknown>;
  recordedAt: string;
};

export type ContentSourceOption = { id: string; title: string; entryType: string; status: string };
export type ContentCampaignOption = { id: string; name: string; campaignKind: string };

export function createEmptyContentVersionInput(title = "Untitled content"): ContentVersionInput {
  return {
    title,
    status: "draft",
    channel: "",
    format: "",
    objective: "",
    audience: "",
    offer: "",
    cta: "",
    campaignId: "",
    brandVoiceGuidelineId: "",
    brandVoiceSnapshot: "",
    sourceMaterials: [],
    body: "",
    authorship: "operator-authored",
    claimFindings: [],
    notes: "",
  };
}
