import type { Initiative } from "@/lib/initiatives/types";
import type { LibraryEntry } from "@/lib/library/types";
import {
  brandVoiceClaimHandlingOptions,
  brandVoiceSourceTypeOptions,
  brandVoiceStatusOptions,
  type BrandVoiceChannelVariation,
  type BrandVoiceClaimBoundary,
  type BrandVoiceExamplePair,
  type BrandVoiceGuidelineInput,
  type BrandVoiceGuidelineRecord,
  type BrandVoiceSourceReference,
  type BrandVoiceStatus,
  type BrandVoiceToneAttribute,
  type BrandVoiceVersionSummary,
} from "@/lib/brand-voice/types";

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

function normalizeId(value: string, prefix: string, index: number) {
  const normalized = value.trim().replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 120);
  return normalized || `${prefix}-${index + 1}`;
}

function assertListLimit(values: unknown[], field: string) {
  if (values.length > MAX_LIST_ITEMS) {
    throw new Error(`${field} cannot contain more than ${MAX_LIST_ITEMS} items.`);
  }
}

function normalizeStringList(values: string[], field: string) {
  assertListLimit(values, field);
  return Array.from(new Set(values.map((value) => normalizeText(value, field)).filter(Boolean)));
}

function normalizeSources(
  values: BrandVoiceSourceReference[],
  initiativeSlug: string,
  eligibleLibraryEntryIds: ReadonlySet<string>
) {
  assertListLimit(values, "Source materials");
  const normalized = values.map((source, index) => {
    assertOption(source.sourceType, brandVoiceSourceTypeOptions, "Source type");
    const result: BrandVoiceSourceReference = {
      id: normalizeId(source.id, "source", index),
      sourceType: source.sourceType,
      label: normalizeText(source.label, "Source label"),
      reference: normalizeText(source.reference, "Source reference"),
      evidenceNote: normalizeText(source.evidenceNote, "Source evidence note"),
    };
    if (!result.label || !result.reference || !result.evidenceNote) {
      throw new Error("Every source requires a label, reference, and evidence note.");
    }
    if (result.sourceType === "initiative-canon" && result.reference !== initiativeSlug) {
      throw new Error("Initiative-canon sources must reference the current initiative.");
    }
    if (
      result.sourceType === "library-entry" &&
      !eligibleLibraryEntryIds.has(result.reference)
    ) {
      throw new Error("Library sources must be eligible entries from the same initiative.");
    }
    if (result.sourceType === "url") {
      let url: URL;
      try {
        url = new URL(result.reference);
      } catch {
        throw new Error("URL sources must contain a valid http or https URL.");
      }
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error("URL sources must use http or https.");
      }
    }
    return result;
  });
  const ids = new Set(normalized.map((source) => source.id));
  if (ids.size !== normalized.length) throw new Error("Source identifiers must be unique.");
  return normalized;
}

function normalizeToneAttributes(values: BrandVoiceToneAttribute[]) {
  assertListLimit(values, "Tone attributes");
  return values.map((item, index) => ({
    id: normalizeId(item.id, "tone", index),
    name: normalizeText(item.name, "Tone attribute"),
    guidance: normalizeText(item.guidance, "Tone guidance"),
  })).filter((item) => item.name || item.guidance);
}

function normalizeClaimBoundaries(values: BrandVoiceClaimBoundary[]) {
  assertListLimit(values, "Claim boundaries");
  return values.map((item, index) => {
    assertOption(item.handling, brandVoiceClaimHandlingOptions, "Claim handling");
    return {
      id: normalizeId(item.id, "claim", index),
      statement: normalizeText(item.statement, "Claim statement"),
      handling: item.handling,
      rationale: normalizeText(item.rationale, "Claim rationale"),
    };
  }).filter((item) => item.statement || item.rationale);
}

function normalizeExamplePairs(values: BrandVoiceExamplePair[]) {
  assertListLimit(values, "Example pairs");
  return values.map((item, index) => ({
    id: normalizeId(item.id, "example", index),
    channel: normalizeText(item.channel, "Example channel"),
    approvedExample: normalizeText(item.approvedExample, "Approved example"),
    counterExample: normalizeText(item.counterExample, "Counterexample"),
    explanation: normalizeText(item.explanation, "Example explanation"),
  })).filter((item) => item.approvedExample || item.counterExample || item.explanation);
}

function normalizeChannelVariations(values: BrandVoiceChannelVariation[]) {
  assertListLimit(values, "Channel variations");
  const normalized = values.map((item, index) => ({
    id: normalizeId(item.id, "channel", index),
    channel: normalizeText(item.channel, "Channel"),
    audienceContext: normalizeText(item.audienceContext, "Channel audience context"),
    guidance: normalizeText(item.guidance, "Channel guidance"),
    ctaStyle: normalizeText(item.ctaStyle, "CTA style"),
  })).filter((item) => item.channel || item.guidance || item.ctaStyle);
  const channels = normalized.map((item) => item.channel.toLowerCase()).filter(Boolean);
  if (new Set(channels).size !== channels.length) {
    throw new Error("Each channel variation must use a unique channel name.");
  }
  return normalized;
}

function assertCompleteForReview(input: BrandVoiceGuidelineInput) {
  const requiredText: Array<[string, string]> = [
    [input.name, "Guideline name"],
    [input.audienceSummary, "Audience summary"],
    [input.positioningSummary, "Positioning summary"],
  ];
  const missingText = requiredText.find(([value]) => !value);
  if (missingText) throw new Error(`${missingText[1]} is required before review.`);

  const requiredLists: Array<[unknown[], string]> = [
    [input.sourceMaterials, "At least one source material"],
    [input.toneAttributes, "At least one tone attribute"],
    [input.allowedLanguage, "At least one allowed-language entry"],
    [input.discouragedLanguage, "At least one discouraged-language entry"],
    [input.claimBoundaries, "At least one claim boundary"],
    [input.examplePairs, "At least one example and counterexample pair"],
    [input.channelVariations, "At least one channel variation"],
  ];
  const missingList = requiredLists.find(([values]) => values.length === 0);
  if (missingList) throw new Error(`${missingList[1]} is required before review.`);

  if (input.toneAttributes.some((item) => !item.name || !item.guidance)) {
    throw new Error("Every tone attribute requires a name and guidance before review.");
  }
  if (input.claimBoundaries.some((item) => !item.statement || !item.rationale)) {
    throw new Error("Every claim boundary requires a statement and rationale before review.");
  }
  if (
    input.examplePairs.some(
      (item) => !item.channel || !item.approvedExample || !item.counterExample || !item.explanation
    )
  ) {
    throw new Error("Every example pair requires a channel, example, counterexample, and explanation.");
  }
  if (
    input.channelVariations.some(
      (item) => !item.channel || !item.audienceContext || !item.guidance || !item.ctaStyle
    )
  ) {
    throw new Error("Every channel variation requires channel, audience, guidance, and CTA style.");
  }
}

export function validateBrandVoiceGuidelineInput(
  input: BrandVoiceGuidelineInput,
  context: { initiativeSlug: string; eligibleLibraryEntryIds: ReadonlySet<string> }
): BrandVoiceGuidelineInput {
  assertOption(input.status, brandVoiceStatusOptions, "Brand voice status");
  const normalized: BrandVoiceGuidelineInput = {
    name: normalizeText(input.name, "Guideline name"),
    status: input.status,
    sourceMaterials: normalizeSources(
      input.sourceMaterials,
      context.initiativeSlug,
      context.eligibleLibraryEntryIds
    ),
    audienceSummary: normalizeText(input.audienceSummary, "Audience summary"),
    positioningSummary: normalizeText(input.positioningSummary, "Positioning summary"),
    toneAttributes: normalizeToneAttributes(input.toneAttributes),
    allowedLanguage: normalizeStringList(input.allowedLanguage, "Allowed language"),
    discouragedLanguage: normalizeStringList(input.discouragedLanguage, "Discouraged language"),
    claimBoundaries: normalizeClaimBoundaries(input.claimBoundaries),
    examplePairs: normalizeExamplePairs(input.examplePairs),
    channelVariations: normalizeChannelVariations(input.channelVariations),
    notes: normalizeText(input.notes, "Notes"),
  };

  if (normalized.status === "review-ready" || normalized.status === "approved") {
    assertCompleteForReview(normalized);
  }
  return normalized;
}

export function assertBrandVoiceStatusTransition(current: BrandVoiceStatus, next: BrandVoiceStatus) {
  const allowed: Record<BrandVoiceStatus, BrandVoiceStatus[]> = {
    draft: ["draft", "review-ready"],
    "review-ready": ["review-ready", "draft", "changes-requested", "approved"],
    "changes-requested": ["changes-requested", "draft", "review-ready"],
    approved: ["approved", "superseded"],
    superseded: ["superseded"],
  };
  if (!allowed[current].includes(next)) {
    throw new Error(`Brand voice status cannot move from ${current} to ${next}.`);
  }
}

export function isEligibleBrandVoiceLibraryEntry(entry: LibraryEntry) {
  const disallowed = new Set(["candidate", "rejected", "archived", "deprecated", "conflicted"]);
  return Boolean(entry.initiativeSlug) && !disallowed.has(entry.status);
}

export function createInitialBrandVoiceInput(initiative: Initiative): BrandVoiceGuidelineInput {
  return {
    name: `${initiative.name} Brand Voice`,
    status: "draft",
    sourceMaterials: [
      {
        id: "initiative-canon",
        sourceType: "initiative-canon",
        label: `${initiative.name} initiative canon`,
        reference: initiative.slug,
        evidenceNote: "Seeded from the persisted initiative narrative, audiences, tone notes, and claim rules.",
      },
    ],
    audienceSummary: initiative.primaryAudiences.map((audience) => audience.label).join(", "),
    positioningSummary: [initiative.oneLiner, initiative.narrative].filter(Boolean).join("\n\n"),
    toneAttributes: initiative.toneNotes
      ? [{ id: "core-tone", name: "Core tone", guidance: initiative.toneNotes }]
      : [],
    allowedLanguage: initiative.allowedClaims.map((rule) => rule.text),
    discouragedLanguage: initiative.bannedClaims.map((rule) => rule.text),
    claimBoundaries: [
      ...initiative.allowedClaims.map((rule, index) => ({
        id: `allowed-${index + 1}`,
        statement: rule.text,
        handling: "allowed" as const,
        rationale: rule.rationale || "Allowed by the current initiative canon.",
      })),
      ...initiative.bannedClaims.map((rule, index) => ({
        id: `avoid-${index + 1}`,
        statement: rule.text,
        handling: "avoid" as const,
        rationale: rule.rationale || "Excluded by the current initiative canon.",
      })),
      ...initiative.needsProofClaims.map((rule, index) => ({
        id: `needs-proof-${index + 1}`,
        statement: rule.text,
        handling: "needs-proof" as const,
        rationale: rule.rationale || "Use only with current, attributable supporting evidence.",
      })),
    ],
    examplePairs: [],
    channelVariations: [],
    notes: "Review the canon-seeded draft and add channel examples before requesting approval.",
  };
}

export function buildBrandVoiceContext(guideline: BrandVoiceGuidelineRecord) {
  const lines = [
    `Brand voice: ${guideline.name} v${guideline.versionNumber}`,
    `Initiative: ${guideline.initiativeSlug}`,
    `Approval state: ${guideline.status}`,
    "",
    "Audience:",
    guideline.audienceSummary,
    "",
    "Positioning:",
    guideline.positioningSummary,
    "",
    "Tone:",
    ...guideline.toneAttributes.map((item) => `- ${item.name}: ${item.guidance}`),
    "",
    "Allowed language:",
    ...guideline.allowedLanguage.map((item) => `- ${item}`),
    "",
    "Discouraged language:",
    ...guideline.discouragedLanguage.map((item) => `- ${item}`),
    "",
    "Claim boundaries:",
    ...guideline.claimBoundaries.map(
      (item) => `- [${item.handling}] ${item.statement}: ${item.rationale}`
    ),
    "",
    "Examples:",
    ...guideline.examplePairs.flatMap((item) => [
      `- ${item.channel} approved: ${item.approvedExample}`,
      `  Counterexample: ${item.counterExample}`,
      `  Why: ${item.explanation}`,
    ]),
    "",
    "Channel variations:",
    ...guideline.channelVariations.map(
      (item) =>
        `- ${item.channel} for ${item.audienceContext}: ${item.guidance} CTA style: ${item.ctaStyle}`
    ),
    "",
    "Sources:",
    ...guideline.sourceMaterials.map(
      (source, index) =>
        `[S${index + 1}] ${source.sourceType}: ${source.label} (${source.reference}) — ${source.evidenceNote}`
    ),
  ];
  return lines.join("\n").trim();
}

export function toBrandVoiceVersionSummary(
  guideline: BrandVoiceGuidelineRecord
): BrandVoiceVersionSummary {
  return {
    id: guideline.id,
    initiativeSlug: guideline.initiativeSlug,
    name: guideline.name,
    versionNumber: guideline.versionNumber,
    status: guideline.status,
    context: buildBrandVoiceContext(guideline),
  };
}
