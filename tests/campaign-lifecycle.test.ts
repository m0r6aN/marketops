import { beforeEach, describe, expect, test } from "vitest";

import {
  getCampaignLifecycle,
  listCampaignLifecycleEvents,
  purgeCampaignLifecycleData,
  saveCampaignLifecycle,
} from "@/lib/campaigns/lifecycle-repository";
import {
  computeCampaignLifecycleProgress,
  validateCampaignLifecycleInput,
} from "@/lib/campaigns/lifecycle-service";
import type { CampaignLifecycleInput } from "@/lib/campaigns/lifecycle-types";

const campaignId = "keon-proof-push";

function buildInput(overrides: Partial<CampaignLifecycleInput> = {}): CampaignLifecycleInput {
  return {
    brief: "Convert proof-aware enterprise buyers into qualified access conversations.",
    offer: "A governed AI execution review and proof walkthrough.",
    audienceSegment: "Security and platform leaders evaluating agent execution controls.",
    selectedCandidateIds: [],
    brandVoiceSummary: "Architecture-first, evidence-backed, and free of autonomous-execution hype.",
    assetPlan: ["Proof tour", "Executive brief", "Founder post"],
    channelPlan: "Owned website, founder-led LinkedIn, and manual one-to-one follow-up.",
    outreachPlan: "Prepare candidate-specific drafts, review facts, then deliver manually.",
    reviewStatus: "approved",
    executionMode: "manual",
    executionStatus: "not-started",
    executionEvidence: "",
    measurementPlan: "Count qualified access requests attributable within 30 days.",
    primaryMetric: "Qualified access requests",
    targetValue: "10 in 30 days",
    actualOutcome: "",
    optimizationNotes: "",
    nextIteration: "",
    ...overrides,
  };
}

beforeEach(() => {
  purgeCampaignLifecycleData(campaignId);
});

describe("full campaign lifecycle", () => {
  test("persists the operator plan and records a reviewable event trail", () => {
    const initial = validateCampaignLifecycleInput(buildInput(), new Set());
    const created = saveCampaignLifecycle(campaignId, initial);

    expect(created.campaignId).toBe(campaignId);
    expect(created.assetPlan).toEqual(["Proof tour", "Executive brief", "Founder post"]);
    expect(listCampaignLifecycleEvents(campaignId)).toHaveLength(1);

    const completed = validateCampaignLifecycleInput(
      buildInput({
        executionStatus: "completed",
        executionEvidence: "Operator recorded delivery through the founder-owned account on 2026-07-18.",
        actualOutcome: "12 qualified access requests were recorded in the 30-day window.",
        optimizationNotes: "Proof-tour visitors converted more often than general landing-page visitors.",
        nextIteration: "Lead with the proof tour and shorten the access-request path.",
      }),
      new Set()
    );
    saveCampaignLifecycle(campaignId, completed);

    const persisted = getCampaignLifecycle(campaignId);
    expect(persisted?.executionStatus).toBe("completed");
    expect(persisted?.actualOutcome).toContain("12 qualified access requests");

    const events = listCampaignLifecycleEvents(campaignId);
    expect(events).toHaveLength(3);
    expect(events.some((event) => event.eventType === "campaign-execution.status-recorded")).toBe(true);
  });

  test("blocks provider-ready records from claiming execution", () => {
    expect(() =>
      validateCampaignLifecycleInput(
        buildInput({
          executionMode: "provider-ready",
          executionStatus: "completed",
          executionEvidence: "Unverified provider result",
        }),
        new Set()
      )
    ).toThrow(/cannot claim execution/i);
  });

  test("requires evidence for a completed manual execution", () => {
    expect(() =>
      validateCampaignLifecycleInput(
        buildInput({ executionStatus: "completed", executionEvidence: "" }),
        new Set()
      )
    ).toThrow(/requires an operator evidence note/i);
  });

  test("rejects candidates outside the campaign initiative", () => {
    expect(() =>
      validateCampaignLifecycleInput(
        buildInput({ selectedCandidateIds: ["candidate-from-another-initiative"] }),
        new Set(["allowed-candidate"])
      )
    ).toThrow(/same initiative/i);
  });

  test("computes lifecycle progress from observable phase evidence", () => {
    const progress = computeCampaignLifecycleProgress(
      buildInput({
        executionStatus: "completed",
        executionEvidence: "Manual execution recorded by operator.",
        actualOutcome: "Target met.",
        optimizationNotes: "Proof-led copy performed best.",
        nextIteration: "Test a shorter CTA.",
      })
    );

    expect(progress.currentPhase).toBe("complete");
    expect(progress.completed).toBe(progress.total);
    expect(progress.percent).toBe(100);
  });
});
