import { beforeEach, describe, expect, test } from "vitest";
import {
  createContentItem,
  createContentVersion,
  getContentVersion,
  purgeContentWorkspaceData,
  updateContentVersion,
} from "@/lib/content-workspace/repository";
import { createEmptyContentVersionInput, type ContentVersionInput, type ContentVersionRecord } from "@/lib/content-workspace/types";
import {
  createPersuasionReview,
  listPersuasionReviewEvents,
  purgePersuasionReviewData,
  recordPersuasionApplyRun,
} from "@/lib/persuasion-review/repository";
import {
  assertReviewApplicable,
  buildPersuasionReview,
  createPersuasionRevisionInput,
} from "@/lib/persuasion-review/service";

const slug = "keon-systems";

function content(status: ContentVersionInput["status"] = "draft"): ContentVersionInput {
  return {
    ...createEmptyContentVersionInput("Proof-led founder post"),
    status,
    channel: "LinkedIn",
    format: "Founder post",
    objective: "Help enterprise platform and security leaders inspect governed execution evidence.",
    audience: "Enterprise platform and security leaders",
    offer: "Governed execution proof walkthrough",
    cta: "Request a proof walkthrough",
    campaignId: "keon-proof-push",
    brandVoiceGuidelineId: "approved-voice",
    brandVoiceSnapshot: "Pinned approved voice v1",
    sourceMaterials: [{
      id: "source-1",
      sourceType: "manual-reference",
      label: "Proof brief",
      reference: "proof-brief-v1",
      evidenceNote: "Operator-reviewed internal proof brief.",
    }],
    body: "Enterprise platform and security leaders can inspect the governed execution proof walkthrough because each policy decision leaves reviewable evidence.",
    claimFindings: [],
  };
}

function record(overrides: Partial<ContentVersionRecord> = {}): ContentVersionRecord {
  return {
    ...content(),
    id: "content-version-1",
    contentItemId: "content-item-1",
    initiativeSlug: slug,
    versionNumber: 1,
    createdAt: "2026-07-22T12:00:00.000Z",
    updatedAt: "2026-07-22T12:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  purgePersuasionReviewData(slug);
  purgeContentWorkspaceData(slug);
});

describe("persuasion review", () => {
  test("records all seven required lenses with rationale, revision, evidence, and risk", () => {
    const review = buildPersuasionReview(record(), []);
    expect(review.assessments).toHaveLength(7);
    expect(review.assessments.map((item) => item.dimension)).toEqual([
      "clarity",
      "audience-relevance",
      "credibility",
      "value-framing",
      "objection-handling",
      "cta-strength",
      "channel-fit",
    ]);
    for (const assessment of review.assessments) {
      expect(assessment.principle).toBeTruthy();
      expect(assessment.audienceRationale).toBeTruthy();
      expect(assessment.suggestedRevision).toBeTruthy();
      expect(assessment.evidenceOrAssumption).toBeTruthy();
      expect(assessment.ethicalRisk).toBeTruthy();
    }
  });

  test("blocks deceptive, fabricated, dark-pattern, sensitive, discriminatory, and unsupported tactics", () => {
    const unsafe = record({
      body: "Act now. Trusted by thousands. You automatically agree. Target users based on medical history. Only men. Production Runtime enforcement.",
    });
    const review = buildPersuasionReview(unsafe, [{
      id: "claim-1",
      handling: "needs-proof",
      statement: "Production Runtime enforcement",
      rationale: "Needs current evidence.",
      origin: "initiative",
    }]);
    expect(new Set(review.issueFlags.map((flag) => flag.type))).toEqual(new Set([
      "deceptive-urgency-scarcity",
      "fabricated-social-proof",
      "unsupported-claim",
      "dark-pattern",
      "sensitive-trait-exploitation",
      "discriminatory-targeting",
    ]));
    expect(review.suggestedBody).toBe(unsafe.body);
  });

  test("persists an immutable review snapshot and creation event", () => {
    const created = createPersuasionReview(buildPersuasionReview(record(), []));
    expect(created.sourceUpdatedAt).toBe("2026-07-22T12:00:00.000Z");
    expect(created.assessments).toHaveLength(7);
    expect(listPersuasionReviewEvents(created.id).map((event) => event.eventType)).toContain("persuasion.review-created");
  });

  test("rejects stale and blocked reviews before revision creation", () => {
    const safeReview = createPersuasionReview(buildPersuasionReview(record(), []));
    expect(() => assertReviewApplicable(safeReview, record({ updatedAt: "2026-07-22T12:01:00.000Z" }), [])).toThrow(/stale/i);

    const blockedReview = createPersuasionReview(buildPersuasionReview(record({ body: "Act now before it is too late." }), []));
    expect(() => assertReviewApplicable(blockedReview, record({ body: "Act now before it is too late." }), [])).toThrow(/blocked/i);
  });

  test("creates a new editable draft while preserving an approved source", () => {
    const source = createContentItem(slug, content());
    updateContentVersion(source.id, content("review-ready"));
    const approved = updateContentVersion(source.id, content("approved"));
    const review = createPersuasionReview(buildPersuasionReview(approved, []));

    assertReviewApplicable(review, approved, []);
    const revision = createContentVersion(approved.id, createPersuasionRevisionInput(review, []));
    recordPersuasionApplyRun({
      persuasionReviewId: review.id,
      sourceContentVersionId: approved.id,
      targetContentVersionId: revision.id,
      status: "succeeded",
      summary: "Created a revision draft; no publishing action occurred.",
    });

    expect(getContentVersion(approved.id)?.status).toBe("approved");
    expect(revision.status).toBe("draft");
    expect(revision.versionNumber).toBe(2);
    expect(revision.body).toContain("Request a proof walkthrough");
    expect(listPersuasionReviewEvents(review.id).map((event) => event.eventType)).toContain("persuasion.revision-created");
  });
});
