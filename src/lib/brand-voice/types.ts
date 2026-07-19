export const brandVoiceStatusOptions = [
  "draft",
  "review-ready",
  "changes-requested",
  "approved",
  "superseded",
] as const;

export const brandVoiceSourceTypeOptions = [
  "initiative-canon",
  "library-entry",
  "url",
  "manual-reference",
] as const;

export const brandVoiceClaimHandlingOptions = ["allowed", "avoid", "needs-proof"] as const;

export type BrandVoiceStatus = (typeof brandVoiceStatusOptions)[number];
export type BrandVoiceSourceType = (typeof brandVoiceSourceTypeOptions)[number];
export type BrandVoiceClaimHandling = (typeof brandVoiceClaimHandlingOptions)[number];

export type BrandVoiceSourceReference = {
  id: string;
  sourceType: BrandVoiceSourceType;
  label: string;
  reference: string;
  evidenceNote: string;
};

export type BrandVoiceToneAttribute = {
  id: string;
  name: string;
  guidance: string;
};

export type BrandVoiceClaimBoundary = {
  id: string;
  statement: string;
  handling: BrandVoiceClaimHandling;
  rationale: string;
};

export type BrandVoiceExamplePair = {
  id: string;
  channel: string;
  approvedExample: string;
  counterExample: string;
  explanation: string;
};

export type BrandVoiceChannelVariation = {
  id: string;
  channel: string;
  audienceContext: string;
  guidance: string;
  ctaStyle: string;
};

export type BrandVoiceGuidelineInput = {
  name: string;
  status: BrandVoiceStatus;
  sourceMaterials: BrandVoiceSourceReference[];
  audienceSummary: string;
  positioningSummary: string;
  toneAttributes: BrandVoiceToneAttribute[];
  allowedLanguage: string[];
  discouragedLanguage: string[];
  claimBoundaries: BrandVoiceClaimBoundary[];
  examplePairs: BrandVoiceExamplePair[];
  channelVariations: BrandVoiceChannelVariation[];
  notes: string;
};

export type BrandVoiceGuidelineRecord = BrandVoiceGuidelineInput & {
  id: string;
  initiativeSlug: string;
  versionNumber: number;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
};

export type BrandVoiceVersionSummary = {
  id: string;
  initiativeSlug: string;
  name: string;
  versionNumber: number;
  status: BrandVoiceStatus;
  context: string;
};

export type BrandVoiceLibrarySourceOption = {
  id: string;
  title: string;
  entryType: string;
  status: string;
  sourceLocation?: string;
};

export type BrandVoiceEvent = {
  id: string;
  guidelineId: string;
  initiativeSlug: string;
  eventType: string;
  summary: string;
  detail: Record<string, unknown>;
  recordedAt: string;
};

export function createEmptyBrandVoiceInput(name = "Brand Voice Guidelines"): BrandVoiceGuidelineInput {
  return {
    name,
    status: "draft",
    sourceMaterials: [],
    audienceSummary: "",
    positioningSummary: "",
    toneAttributes: [],
    allowedLanguage: [],
    discouragedLanguage: [],
    claimBoundaries: [],
    examplePairs: [],
    channelVariations: [],
    notes: "",
  };
}
