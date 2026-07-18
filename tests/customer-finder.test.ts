import { beforeEach, describe, expect, test } from "vitest";

import {
  createDiscoveryCampaignRecord,
  findDiscoveryCampaignByFingerprint,
  getDiscoveryCampaignDetail,
  purgeAllCustomerFinderData,
  replaceCampaignCandidates,
  saveSourceRun,
  updateCampaignProcessingState,
} from "@/lib/customer-finder/repository";
import {
  assertOutboundDeliveryBlocked,
  buildSubmissionFingerprint,
  computeRetentionExpiry,
  dedupeCandidates,
  normalizeText,
  prepareOutreachDraft,
  processSelectedSource,
  toCampaignName,
  toSlug,
  toSourceRun,
} from "@/lib/customer-finder/service";
import { buildSourceProposals } from "@/lib/customer-finder/sources";

beforeEach(() => {
  purgeAllCustomerFinderData();
});

describe("customer finder workflow", () => {
  test("primary flow persists a planning campaign and manual CSV candidates", async () => {
    const nowIso = "2026-07-18T12:00:00.000Z";
    const requestFingerprint = buildSubmissionFingerprint({
      prompt: "Find AI workflow builders for client work",
      targetDescription: "Startups and solo entrepreneurs developing AI-powered workflows for clients",
      selectedSourceIds: ["manual_csv"],
      sourceInputs: {
        manual_csv:
          "name,organization,source_url,reason,evidence,contact_channel,contact_value\nJane Doe,Acme Automations,https://acme.example/team,Matches target,Founder bio mentions client workflow automation,email,jane@acme.example\nJohn Smith,Studio Flow,https://studioflow.example/about,Matches target,Company page says they build AI workflow systems,website,https://studioflow.example",
      },
      idempotencyKey: "same-submit",
    });

    createDiscoveryCampaignRecord({
      id: "camp-primary-flow",
      slug: `${toSlug("AI workflow builders")}-primary`,
      campaignName: toCampaignName("AI workflow builders"),
      initiativeSlug: "workspace-discovery",
      originPrompt: "Find AI workflow builders for client work",
      targetDescription: "Startups and solo entrepreneurs developing AI-powered workflows for clients",
      normalizedTargetDescription: normalizeText(
        "Startups and solo entrepreneurs developing AI-powered workflows for clients"
      ),
      requestFingerprint,
      provenance: { source: "test" },
      createdAt: nowIso,
      retentionExpiresAt: computeRetentionExpiry(nowIso),
      selectedChannels: ["email"],
    });

    const sourceRun = toSourceRun({
      sourceId: "manual_csv",
      selected: true,
      rationale: "Manual operator-verified lead import.",
      inputText:
        "name,organization,source_url,reason,evidence,contact_channel,contact_value\nJane Doe,Acme Automations,https://acme.example/team,Matches target,Founder bio mentions client workflow automation,email,jane@acme.example\nJohn Smith,Studio Flow,https://studioflow.example/about,Matches target,Company page says they build AI workflow systems,website,https://studioflow.example",
    });

    saveSourceRun("camp-primary-flow", sourceRun, nowIso);

    const processed = await processSelectedSource({
      sourceRun,
      targetDescription: "Startups and solo entrepreneurs developing AI-powered workflows for clients",
      nowIso,
    });

    const deduped = dedupeCandidates(processed.candidates);
    replaceCampaignCandidates("camp-primary-flow", deduped, nowIso);
    updateCampaignProcessingState({
      campaignId: "camp-primary-flow",
      status: "planning",
      discoveryStatus: "completed",
      notes: "Discovered 2 candidates.",
      lastProcessedAt: nowIso,
    });

    const detail = getDiscoveryCampaignDetail("camp-primary-flow");
    expect(detail).toBeDefined();
    expect(detail?.campaign.status).toBe("planning");
    expect(detail?.campaign.targetDescription).toContain("AI-powered workflows");
    expect(detail?.sourceRuns).toHaveLength(1);
    expect(detail?.candidates).toHaveLength(2);
    expect(detail?.candidates[0]?.verifiedEvidence.length).toBeGreaterThan(10);
  });

  test("duplicate submission fingerprint resolves to the same campaign", () => {
    const fingerprint = buildSubmissionFingerprint({
      prompt: "Find founders",
      targetDescription: "AI founders",
      selectedSourceIds: ["manual_csv", "github"],
      sourceInputs: { manual_csv: "name\nJane" },
      idempotencyKey: "same-click",
    });

    createDiscoveryCampaignRecord({
      id: "camp-dup",
      slug: "ai-founders-camp",
      campaignName: toCampaignName("AI founders"),
      initiativeSlug: "workspace-discovery",
      originPrompt: "Find founders",
      targetDescription: "AI founders",
      normalizedTargetDescription: normalizeText("AI founders"),
      requestFingerprint: fingerprint,
      provenance: { source: "test" },
      createdAt: "2026-07-18T12:00:00.000Z",
      retentionExpiresAt: "2026-10-16T12:00:00.000Z",
      selectedChannels: ["email"],
    });

    const existing = findDiscoveryCampaignByFingerprint(fingerprint);
    expect(existing?.id).toBe("camp-dup");
  });

  test("source failure is visible for website processing without seed URLs", async () => {
    const sourceRun = toSourceRun({
      sourceId: "company_websites",
      selected: true,
      rationale: "Need public website evidence.",
      inputText: "",
    });

    const processed = await processSelectedSource({
      sourceRun,
      targetDescription: "AI workflow consultancies",
      nowIso: "2026-07-18T12:00:00.000Z",
    });

    expect(processed.status).toBe("failed");
    expect(processed.errorMessage).toContain("Seed URLs are required");
  });

  test("empty manual CSV produces an honest empty result", async () => {
    const sourceRun = toSourceRun({
      sourceId: "manual_csv",
      selected: true,
      rationale: "No rows yet.",
      inputText: "name,organization\n",
    });

    const processed = await processSelectedSource({
      sourceRun,
      targetDescription: "B2B AI builders",
      nowIso: "2026-07-18T12:00:00.000Z",
    });

    expect(processed.status).toBe("empty");
    expect(processed.candidates).toHaveLength(0);
  });

  test("deduplication preserves combined source provenance", async () => {
    const csvRun = toSourceRun({
      sourceId: "manual_csv",
      selected: true,
      rationale: "Manual seed.",
      inputText:
        "name,organization,source_url,reason,evidence,contact_channel,contact_value\nJane Doe,Acme AI,https://acme.example/team,Matches target,Builds AI workflow automation,website,https://acme.example",
    });
    const csvProcessed = await processSelectedSource({
      sourceRun: csvRun,
      targetDescription: "AI workflow automation companies",
      nowIso: "2026-07-18T12:00:00.000Z",
    });

    const githubRun = toSourceRun({
      sourceId: "github",
      selected: true,
      rationale: "Public repos overlap with the target.",
      inputText: "acme-ai",
    });
    const githubProcessed = await processSelectedSource({
      sourceRun: githubRun,
      targetDescription: "AI workflow automation companies",
      nowIso: "2026-07-18T12:00:00.000Z",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            items: [
              {
                full_name: "acme-ai/workflows",
                description: "AI workflow automation for client services",
                html_url: "https://github.com/acme-ai/workflows",
                homepage: "https://acme.example",
                topics: ["ai", "workflow", "automation"],
                owner: {
                  login: "Acme AI",
                  type: "Organization",
                  html_url: "https://github.com/acme-ai",
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        ),
    });

    const deduped = dedupeCandidates([...csvProcessed.candidates, ...githubProcessed.candidates]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.provenance).toHaveLength(2);
    expect(deduped[0]?.sourceSummary).toContain("Manual CSV import");
    expect(deduped[0]?.sourceSummary).toContain("GitHub organizations and repositories");
  });

  test("authorization boundary blocks outbound delivery and keeps drafts review-required", () => {
    const draft = prepareOutreachDraft({
      campaignName: "AI workflow builders customer discovery",
      targetDescription: "AI workflow builders",
      initiativeName: "ForgePilot",
      initiativeOneLiner: "ForgePilot helps builders turn ideas into shipped product workflows.",
      candidate: {
        id: "cand-1",
        candidateKind: "organization",
        displayName: "Acme AI",
        organizationName: "Acme AI",
        matchReason: "Public repo metadata overlaps with the target.",
        verifiedEvidence: "Repository description says AI workflow automation for client services.",
        confidenceLabel: "high",
        confidenceScore: 0.88,
        contactChannel: "website",
        contactValue: "https://acme.example",
        discoveryTimestamp: "2026-07-18T12:00:00.000Z",
        sourceSummary: "GitHub organizations and repositories",
        provenance: [],
      },
      channel: "email",
    });

    expect(draft.approvalStatus).toBe("review-required");
    expect(() => assertOutboundDeliveryBlocked()).toThrow(/not authorized/i);
  });

  test("source checklist labels unsupported sources honestly", () => {
    const proposals = buildSourceProposals("B2B founders building AI workflows");
    const unsupported = proposals.find((proposal) => proposal.id === "linkedin_public");
    expect(unsupported?.supportLevel).toBe("unsupported");
    expect(unsupported?.selectedByDefault).toBe(false);
    expect(unsupported?.availabilityNote).toContain("future source");
  });
});
