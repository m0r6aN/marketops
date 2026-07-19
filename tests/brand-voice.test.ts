import { beforeEach, describe, expect, test } from "vitest";

import {
  createBrandVoiceGuideline,
  getBrandVoiceGuideline,
  listBrandVoiceEvents,
  purgeBrandVoiceData,
  updateBrandVoiceGuideline,
} from "@/lib/brand-voice/repository";
import {
  buildBrandVoiceContext,
  createInitialBrandVoiceInput,
  validateBrandVoiceGuidelineInput,
} from "@/lib/brand-voice/service";
import type { BrandVoiceGuidelineInput } from "@/lib/brand-voice/types";
import { getInitiativeBySlug } from "@/lib/initiatives/repository";

const slug = "keon-systems";
const context = { initiativeSlug: slug, eligibleLibraryEntryIds: new Set<string>() };

function complete(input: BrandVoiceGuidelineInput, status: BrandVoiceGuidelineInput["status"]): BrandVoiceGuidelineInput {
  return {
    ...input,
    status,
    examplePairs: [{
      id: "website-example",
      channel: "Website",
      approvedExample: "Inspect the evidence behind every execution claim.",
      counterExample: "Trust the most powerful autonomous AI ever built.",
      explanation: "The approved example is concrete and reviewable without unsupported superlatives.",
    }],
    channelVariations: [{
      id: "website",
      channel: "Website",
      audienceContext: "Enterprise platform and security leaders",
      guidance: "Lead with architecture and verifiable evidence.",
      ctaStyle: "Invite a proof walkthrough.",
    }],
  };
}

beforeEach(() => purgeBrandVoiceData(slug));

describe("brand voice guidelines", () => {
  test("seeds a provenance-backed draft from initiative canon", () => {
    const initiative = getInitiativeBySlug(slug)!;
    const draft = createInitialBrandVoiceInput(initiative);

    expect(draft.status).toBe("draft");
    expect(draft.sourceMaterials[0]).toMatchObject({ sourceType: "initiative-canon", reference: slug });
    expect(draft.audienceSummary).toContain("CISO");
    expect(draft.claimBoundaries.length).toBeGreaterThan(0);
  });

  test("requires examples and channel guidance before review", () => {
    const initiative = getInitiativeBySlug(slug)!;
    expect(() => validateBrandVoiceGuidelineInput(
      { ...createInitialBrandVoiceInput(initiative), status: "review-ready" },
      context
    )).toThrow(/example and counterexample/i);
  });

  test("rejects ineligible or cross-initiative library provenance", () => {
    const initiative = getInitiativeBySlug(slug)!;
    const input = createInitialBrandVoiceInput(initiative);
    input.sourceMaterials.push({
      id: "foreign-source",
      sourceType: "library-entry",
      label: "Foreign source",
      reference: "not-eligible",
      evidenceNote: "Should not cross initiative boundaries.",
    });
    expect(() => validateBrandVoiceGuidelineInput(input, context)).toThrow(/same initiative/i);
  });

  test("versions, approves, supersedes, and keeps approved records immutable", () => {
    const initiative = getInitiativeBySlug(slug)!;
    const draft = validateBrandVoiceGuidelineInput(createInitialBrandVoiceInput(initiative), context);
    const first = createBrandVoiceGuideline(slug, draft);
    const reviewReady = validateBrandVoiceGuidelineInput(complete(draft, "review-ready"), context);
    updateBrandVoiceGuideline(first.id, reviewReady);
    const approvedFirst = updateBrandVoiceGuideline(
      first.id,
      validateBrandVoiceGuidelineInput({ ...reviewReady, status: "approved" }, context)
    );
    expect(approvedFirst.status).toBe("approved");
    expect(() => updateBrandVoiceGuideline(first.id, { ...approvedFirst, notes: "mutated" })).toThrow(/immutable/i);

    const secondDraft = createBrandVoiceGuideline(slug, { ...draft, notes: "Created from version 1." });
    const secondReview = validateBrandVoiceGuidelineInput(complete(secondDraft, "review-ready"), context);
    updateBrandVoiceGuideline(secondDraft.id, secondReview);
    updateBrandVoiceGuideline(
      secondDraft.id,
      validateBrandVoiceGuidelineInput({ ...secondReview, status: "approved" }, context)
    );

    expect(getBrandVoiceGuideline(first.id)?.status).toBe("superseded");
    expect(getBrandVoiceGuideline(secondDraft.id)?.status).toBe("approved");
    expect(listBrandVoiceEvents(first.id).some((event) => event.eventType === "brand-voice.version-superseded")).toBe(true);
  });

  test("builds a deterministic campaign context with indexed sources", () => {
    const initiative = getInitiativeBySlug(slug)!;
    const created = createBrandVoiceGuideline(
      slug,
      validateBrandVoiceGuidelineInput(createInitialBrandVoiceInput(initiative), context)
    );
    const contextText = buildBrandVoiceContext(created);
    expect(contextText).toContain("Brand voice: Keon Systems Brand Voice v1");
    expect(contextText).toContain("[S1] initiative-canon");
    expect(contextText).toBe(buildBrandVoiceContext(created));
  });
});
