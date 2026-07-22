import { beforeEach, describe, expect, test } from "vitest";
import {
  createContentItem,
  createContentVersion,
  getContentVersion,
  listContentEvents,
  purgeContentWorkspaceData,
  updateContentVersion,
} from "@/lib/content-workspace/repository";
import {
  buildContentGenerationPrompt,
  computeContentClaimFindings,
  validateContentVersionInput,
} from "@/lib/content-workspace/service";
import { createEmptyContentVersionInput, type ContentVersionInput } from "@/lib/content-workspace/types";
import { getInitiativeBySlug } from "@/lib/initiatives/repository";
import type { BrandVoiceGuidelineRecord } from "@/lib/brand-voice/types";

const slug = "keon-systems";
const validationContext = {
  initiativeSlug: slug,
  libraryEntryIds: new Set<string>(),
  campaignIds: new Set(["keon-proof-push"]),
  brandVoiceGuidelineIds: new Set(["approved-voice"]),
};

function complete(status: ContentVersionInput["status"] = "draft"): ContentVersionInput {
  return {
    ...createEmptyContentVersionInput("Proof-led founder post"), status,
    channel: "LinkedIn",
    format: "Founder post",
    objective: "Invite qualified buyers to inspect the proof path.",
    audience: "Enterprise platform and security leaders",
    offer: "Governed execution proof walkthrough",
    cta: "Request a proof walkthrough",
    campaignId: "keon-proof-push",
    brandVoiceGuidelineId: "approved-voice",
    brandVoiceSnapshot: "Pinned approved voice v1",
    sourceMaterials: [{ id: "source-1", sourceType: "manual-reference", label: "Proof brief", reference: "proof-brief-v1", evidenceNote: "Operator-reviewed internal proof brief." }],
    body: "Inspect how policy decisions precede effects and leave reviewable evidence.",
    claimFindings: [],
  };
}

beforeEach(() => purgeContentWorkspaceData(slug));

describe("content workspace", () => {
  test("requires same-initiative campaign and approved brand voice references", () => {
    expect(() => validateContentVersionInput({ ...complete(), campaignId: "foreign" }, validationContext)).toThrow(/same initiative|current initiative/i);
    expect(() => validateContentVersionInput({ ...complete(), brandVoiceGuidelineId: "unapproved" }, validationContext)).toThrow(/approved versions/i);
  });

  test("requires provenance and a pinned voice before review", () => {
    expect(() => validateContentVersionInput({ ...complete("review-ready"), sourceMaterials: [] }, validationContext)).toThrow(/provenance/i);
    expect(() => validateContentVersionInput({ ...complete("review-ready"), brandVoiceGuidelineId: "", brandVoiceSnapshot: "" }, validationContext)).toThrow(/brand voice/i);
  });

  test("finds literal initiative and brand-voice claim boundaries", () => {
    const initiative = getInitiativeBySlug(slug)!;
    const voice = { claimBoundaries: [{ id: "voice-claim", statement: "instant compliance", handling: "avoid", rationale: "Unsupported outcome." }] } as BrandVoiceGuidelineRecord;
    const findings = computeContentClaimFindings(initiative, "We offer instant compliance and production Runtime enforcement.", voice);
    expect(findings.map((finding) => finding.handling)).toContain("avoid");
    expect(findings.map((finding) => finding.handling)).toContain("needs-proof");
  });

  test("versions, approves, supersedes, and preserves immutable records", () => {
    const first = createContentItem(slug, complete());
    updateContentVersion(first.id, complete("review-ready"));
    updateContentVersion(first.id, complete("approved"));
    expect(() => updateContentVersion(first.id, { ...complete("approved"), body: "mutated" })).toThrow(/immutable/i);

    const second = createContentVersion(first.id, { ...complete(), notes: "Created from version 1." });
    updateContentVersion(second.id, complete("review-ready"));
    updateContentVersion(second.id, complete("approved"));
    expect(getContentVersion(first.id)?.status).toBe("superseded");
    expect(getContentVersion(second.id)?.status).toBe("approved");
    expect(listContentEvents(first.id).some((event) => event.eventType === "content.version-superseded")).toBe(true);
  });

  test("builds a deterministic, source-indexed generation prompt", () => {
    const prompt = buildContentGenerationPrompt(complete(), [{ label: "Proof brief", content: "Verified architecture evidence." }]);
    expect(prompt).toContain("[S1] Proof brief");
    expect(prompt).toContain("Pinned approved voice v1");
    expect(prompt).toContain("UNTRUSTED SOURCE MATERIAL");
    expect(prompt).toBe(buildContentGenerationPrompt(complete(), [{ label: "Proof brief", content: "Verified architecture evidence." }]));
  });
});
