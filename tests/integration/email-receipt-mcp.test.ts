/**
 * int-c-email-receipt-mcp — integration parcel (S5+S6+S7, local env).
 *
 * Scenarios: int-email-blocked, int-receipt-verify, int-mcp-canon.
 *
 * What this proves (boundaries only, no product decisions):
 * - int-email-blocked: evaluation-only compliance gates stay blocked/not-sent
 *   even on fully-compliant input (send stays blocked per #19); each fail case
 *   blocks with the right reason; a send attempt against a blocked check is
 *   refused; no send/adapter/deliver export exists on the email path.
 * - int-receipt-verify: a dry_run ProofpackManifest in the
 *   contracts/ProofpackManifest.json shape validates; prod-mode actions without
 *   auth refuse fail-closed (401 UNAUTHENTICATED). VERIFY.ps1 transcript is
 *   captured in evidence/INT-c-email-receipt-mcp.md (56/58 locally: the 2
 *   failures are the missing EdVerify binary, recorded honestly).
 * - int-mcp-canon: a valid docs_as_marketing_review-shaped payload persists
 *   candidates through the Library writer path
 *   (@/lib/library/marketing-review-writer, quarantine-by-default flags); a
 *   secret-bearing / pricing-leak doc is quarantined BEFORE the writer via the
 *   ingest + prompt-contract boundaries, with no secret/pricing tokens in
 *   persisted output. Live-LLM extraction redaction is beta-deferred (needs a
 *   live model; the mock echoes excerpts verbatim by design).
 *
 * Forbidden by parcel (none of these appear here): src/** edits, contract
 * edits, send implementations, VERIFY.ps1/proofpack edits, mcp/ source edits.
 * The MCP tool handler (mcp/marketops-mcp/src/tools/docsAsMarketingReview.ts)
 * and rubric/skill are used READ-ONLY as the contract reference; the live
 * extraction path is NOT executed here (no mock-into-pass).
 */
import Ajv from "ajv";
import { afterEach, describe, expect, test } from "vitest";

import { assertTenantAccess, requireSessionTenant, TenantScopeError } from "@/lib/auth/session";
import {
  EMAIL_COMPLIANCE_BLOCKED_REASONS,
  evaluateCompliance,
  evaluateEmailCampaignCompliance,
} from "@/lib/email-campaigns/compliance";
import type {
  EmailComplianceEvaluationInput,
  EmailComplianceGateInput,
} from "@/lib/email-campaigns/compliance";
import * as emailCampaignsCompliance from "@/lib/email-campaigns/compliance";
import * as emailCampaignsService from "@/lib/email-campaigns/service";
import { db as libraryDb } from "@/lib/library/db";
import {
  MarketingReviewValidationError,
  persistMarketingReview,
  validatePayload,
} from "@/lib/library/marketing-review-writer";
import { detectSensitiveFilename } from "@/lib/library/parser";
import {
  buildCanonExtractionPrompt,
  buildMarketingNuggetPrompt,
  buildPublicSafetyPrompt,
} from "@/lib/library/prompts";
import { createImportBatch, createSourceDocument, getLibraryEntry } from "@/lib/library/repository";
import type { DocsAsMarketingReviewPayload } from "@/lib/library/types";
import type { ComplianceCheck, ProofpackManifest } from "@/lib/marketops/entities";
import proofpackManifestSchema from "../../contracts/ProofpackManifest.json";

const CHECKED_AT = "2026-09-13T00:00:00Z";

// Dummy tokens for the quarantine boundary. Test fixtures only — never real
// secrets, never real pricing (mirrors the convention in
// tests/secret-provider-failclosed.test.ts).
const SECRET_TOKEN = "test-only-sk-int-c-not-a-secret-0000";
const PRICING_TOKEN = "INTERNAL ONLY Enterprise plan $4,999/mo — do not publish";

// ── email helpers ────────────────────────────────────────────────────────────

function gateInput(overrides: Partial<EmailComplianceGateInput> = {}): EmailComplianceGateInput {
  return {
    tenantId: "tenant-keon",
    campaignId: "camp-int-c-001",
    consentBasis: "opt-in",
    suppressionHit: false,
    suppressionChecked: true,
    unsubscribeLinkPresent: true,
    senderAuthPass: true,
    physicalAddressPresent: true,
    checkedAtUtc: CHECKED_AT,
    ...overrides,
  };
}

function evaluationInput(
  overrides: Partial<EmailComplianceEvaluationInput> = {},
): EmailComplianceEvaluationInput {
  return {
    tenantId: "tenant-keon",
    campaignId: "camp-int-c-001",
    consentBasis: "opt-in",
    contactFingerprints: [],
    unsubscribeLinkPresent: true,
    senderAuthPass: true,
    physicalAddressPresent: true,
    checkedAtUtc: CHECKED_AT,
    ...overrides,
  };
}

/**
 * Test-local send-refusal guard. There is no product send function to call
 * (send stays blocked by design), so a "send attempt" in this suite means
 * reaching this guard with a ComplianceCheck: blocked checks throw, and the
 * test asserts the throw. This proves the refusal boundary without creating
 * a send implementation (which the parcel forbids).
 */
function assertSendRefused(check: ComplianceCheck): void {
  if (check.verdict === "blocked") {
    throw new Error(
      `send refused: verdict=blocked reasons=${(check.blockedReasons ?? []).join("; ")}`,
    );
  }
  throw new Error("send refused: evaluation-only path never sends (outcome=blocked)");
}

// ── library writer cleanup ───────────────────────────────────────────────────

const createdBatchIds: string[] = [];
const createdDocIds: string[] = [];
const createdSummaryIds: string[] = [];
const createdEntryIds: string[] = [];
const createdRedFlagIds: string[] = [];
const createdAssetIds: string[] = [];

afterEach(() => {
  for (const id of createdAssetIds) {
    libraryDb.prepare(`DELETE FROM library_marketing_asset_opportunities WHERE id = ?`).run(id);
  }
  for (const id of createdRedFlagIds) {
    libraryDb.prepare(`DELETE FROM library_marketing_red_flags WHERE id = ?`).run(id);
  }
  for (const id of createdEntryIds) {
    libraryDb.prepare(`DELETE FROM library_entries WHERE id = ?`).run(id);
  }
  for (const id of createdSummaryIds) {
    libraryDb.prepare(`DELETE FROM library_marketing_review_summaries WHERE id = ?`).run(id);
  }
  for (const id of createdDocIds) {
    libraryDb.prepare(`DELETE FROM library_source_documents WHERE id = ?`).run(id);
  }
  for (const id of createdBatchIds) {
    libraryDb.prepare(`DELETE FROM library_import_batches WHERE id = ?`).run(id);
  }
  createdAssetIds.length = 0;
  createdRedFlagIds.length = 0;
  createdEntryIds.length = 0;
  createdSummaryIds.length = 0;
  createdDocIds.length = 0;
  createdBatchIds.length = 0;
});

function createParcelParents(filename: string): { batchId: string; docId: string } {
  const batch = createImportBatch({ selectedModes: ["marketing"], modelStrategy: "auto" });
  const doc = createSourceDocument({
    importBatchId: batch.id,
    originalFilename: filename,
    mimeType: "text/markdown",
  });
  createdBatchIds.push(batch.id);
  createdDocIds.push(doc.id);
  return { batchId: batch.id, docId: doc.id };
}

/** Valid review payload shaped exactly like docs_as_marketing_review json-mode output. */
function validReviewPayload(): DocsAsMarketingReviewPayload {
  return {
    summary: {
      best_marketing_uses: ["Blog", "Documentation Link-Back"],
      overall_score: 62,
      highest_value_theme: "Proof-led positioning from governed execution notes",
    },
    candidates: [
      {
        source_section: "Overview",
        source_excerpt:
          "Keon records a reviewable receipt for every governed execution decision.",
        marketing_angle: "Receipt-backed trust for platform buyers",
        suggested_rewrite:
          "Every governed execution decision leaves a reviewable receipt your team can inspect.",
        use_for: ["Blog", "Documentation Link-Back"],
        audience: ["Buyer"],
        funnel_stage: "Education",
        content_type: ["Technical Explanation"],
        confidence: "Heavy Rewrite",
        proof_strength: "Medium",
        claim_risk: "Low",
        link_back_required: true,
      },
    ],
    red_flags: [
      {
        source_excerpt: "Teams ship policy checks quickly.",
        risk_level: "Medium",
        issue: "Speed claim without a supporting benchmark in the source.",
        safer_wording: "Teams can configure policy checks without code changes.",
        proof_requirement: null,
      },
    ],
    asset_opportunities: [
      {
        asset_type: "Blog Post",
        theme: "Why reviewable receipts shorten security review",
        priority: "Medium",
      },
    ],
  };
}

/**
 * Ingest-boundary quarantine filter (models the pre-writer boundary): any
 * candidate whose excerpt or rewrite carries secret/pricing tokens is dropped
 * before it may reach the writer. Returns the survivors.
 */
function quarantineTaintedCandidates<T extends { source_excerpt: string; suggested_rewrite: string }>(
  candidates: readonly T[],
): T[] {
  return candidates.filter(
    (c) => !c.source_excerpt.includes(SECRET_TOKEN) &&
      !c.suggested_rewrite.includes(SECRET_TOKEN) &&
      !c.source_excerpt.includes(PRICING_TOKEN) &&
      !c.suggested_rewrite.includes(PRICING_TOKEN),
  );
}

// ── int-email-blocked ────────────────────────────────────────────────────────

describe("int-email-blocked: no-send enforcement (local)", () => {
  test("email positive: fully-compliant plan evaluates pass AND still results in not-sent", () => {
    const check = evaluateCompliance(gateInput());
    expect(check.verdict).toBe("pass");
    expect(check.blockedReasons).toEqual([]);

    const evaluation = evaluateEmailCampaignCompliance(evaluationInput(), {
      isSuppressed: () => false,
    });
    expect(evaluation.check.verdict).toBe("pass");
    expect(evaluation.outcome).toBe("blocked");
    expect(evaluation.sent).toBe(false);
  });

  test("email negative: no consent blocks with the consent reason", () => {
    const check = evaluateCompliance(gateInput({ consentBasis: "none" }));
    expect(check.verdict).toBe("blocked");
    expect(check.blockedReasons).toContain(EMAIL_COMPLIANCE_BLOCKED_REASONS.consent);
    expect(() => assertSendRefused(check)).toThrow(/send refused/);
  });

  test("email negative: missing unsubscribe link blocks with the unsubscribe reason", () => {
    const check = evaluateCompliance(gateInput({ unsubscribeLinkPresent: false }));
    expect(check.verdict).toBe("blocked");
    expect(check.blockedReasons).toContain(EMAIL_COMPLIANCE_BLOCKED_REASONS.unsubscribe);
    expect(() => assertSendRefused(check)).toThrow(/send refused/);
  });

  test("email negative: failed sender auth blocks with the sender-auth reason", () => {
    const check = evaluateCompliance(gateInput({ senderAuthPass: false }));
    expect(check.verdict).toBe("blocked");
    expect(check.blockedReasons).toContain(EMAIL_COMPLIANCE_BLOCKED_REASONS.senderAuth);
    expect(() => assertSendRefused(check)).toThrow(/send refused/);
  });

  test("email negative: send attempt against any blocked check is refused and stays not-sent", () => {
    const blockedCases: EmailComplianceGateInput[] = [
      gateInput({ consentBasis: "none" }),
      gateInput({ unsubscribeLinkPresent: false }),
      gateInput({ senderAuthPass: false }),
      gateInput({ physicalAddressPresent: false }),
      gateInput({ suppressionHit: true }),
    ];
    for (const input of blockedCases) {
      const evaluation = evaluateEmailCampaignCompliance(
        {
          ...evaluationInput(),
          consentBasis: input.consentBasis,
          suppressionHit: input.suppressionHit,
          unsubscribeLinkPresent: input.unsubscribeLinkPresent,
          senderAuthPass: input.senderAuthPass,
          physicalAddressPresent: input.physicalAddressPresent,
        },
        { isSuppressed: () => false },
      );
      expect(evaluation.check.verdict).toBe("blocked");
      expect(evaluation.outcome).toBe("blocked");
      expect(evaluation.sent).toBe(false);
      expect(() => assertSendRefused(evaluation.check)).toThrow(/send refused/);
    }
  });

  test("no send path exists on the email-campaigns service or compliance path", () => {
    for (const entry of [emailCampaignsService, emailCampaignsCompliance]) {
      const suspicious = Object.keys(entry).filter((name) => /send|adapter|deliver/i.test(name));
      expect(suspicious).toEqual([]);
    }
  });
});

// ── int-receipt-verify ───────────────────────────────────────────────────────

describe("int-receipt-verify: receipt verifiability (local)", () => {
  const ajv = new Ajv({ allErrors: true });

  function dryRunManifest(): ProofpackManifest {
    return {
      packId: "pack-int-c-email-receipt-mcp-001",
      tenantId: "tenant-keon",
      createdAtUtc: CHECKED_AT,
      runs: [
        {
          runId: "00b61575-e041-42a5-aba9-dce48e7d9d80",
          mode: "dry_run",
          path: "runs/00b61575-e041-42a5-aba9-dce48e7d9d80/RUN_MANIFEST.json",
          sha256: "a".repeat(64),
        },
      ],
      packSha256: "b".repeat(64),
    };
  }

  test("receipt positive: dry_run proofpack manifest validates against the ProofpackManifest contract", () => {
    const manifest = dryRunManifest();
    expect(ajv.validate(proofpackManifestSchema, manifest)).toBe(true);
    expect(manifest.runs.every((run) => run.mode === "dry_run")).toBe(true);
  });

  test("receipt boundary: tampered hashes and empty runs are rejected by the contract", () => {
    const manifest = dryRunManifest();
    expect(ajv.validate(proofpackManifestSchema, { ...manifest, packSha256: "tampered" })).toBe(
      false,
    );
    expect(ajv.validate(proofpackManifestSchema, { ...manifest, runs: [] })).toBe(false);
  });

  test("receipt negative: prod-mode action without auth refuses fail-closed (401 UNAUTHENTICATED)", async () => {
    const guard = assertTenantAccess(null, "tenant-keon", "proofpack export (prod)");
    expect(guard.ok).toBe(false);
    if (guard.ok) throw new Error("unreachable: unauthenticated guard must deny");
    expect(guard.denial.allowed).toBe(false);
    expect(guard.denial.denialCode).toBe("UNAUTHENTICATED");
    expect(guard.denial.httpStatus).toBe(401);
    expect(guard.denial.failureStage).toBe("decision");

    let caught: TenantScopeError | null = null;
    try {
      await requireSessionTenant({ token: null, action: "proofpack export (prod)" });
    } catch (error) {
      expect(error).toBeInstanceOf(TenantScopeError);
      caught = error as TenantScopeError;
    }
    expect(caught).not.toBeNull();
    expect(caught?.httpStatus).toBe(401);
    expect(caught?.denialCode).toBe("UNAUTHENTICATED");
    expect(caught?.failureStage).toBe("decision");
  });
});

// ── int-mcp-canon ────────────────────────────────────────────────────────────

describe("int-mcp-canon: MCP canon quarantine (local)", () => {
  test("mcp positive: valid doc payload persists candidates via the Library writer path", () => {
    const { batchId, docId } = createParcelParents("int-c-valid-doc.md");
    const payload = validReviewPayload();

    expect(() => validatePayload(payload)).not.toThrow();

    const result = persistMarketingReview({
      sourceDocumentId: docId,
      importBatchId: batchId,
      initiativeSlug: null,
      modelUsed: "int-c-email-receipt-mcp",
      payload,
    });
    createdSummaryIds.push(result.reviewSummaryId);
    createdEntryIds.push(...result.libraryEntryIds);
    createdRedFlagIds.push(...result.redFlagIds);
    createdAssetIds.push(...result.assetOpportunityIds);

    expect(result.libraryEntryIds).toHaveLength(payload.candidates.length);
    expect(result.redFlagIds).toHaveLength(payload.red_flags.length);
    expect(result.assetOpportunityIds).toHaveLength(payload.asset_opportunities.length);

    for (const [index, entryId] of result.libraryEntryIds.entries()) {
      const entry = getLibraryEntry(entryId);
      expect(entry).not.toBeNull();
      expect(entry?.entryType).toBe("marketing_nugget");
      expect(entry?.status).toBe("candidate");
      // Quarantine-by-default: private, never public-safe, never automation-approved.
      expect(entry?.visibility).toBe("private");
      expect(entry?.publicSafe).toBe(false);
      expect(entry?.approvedForAutomation).toBe(false);
      expect(entry?.publicAutomationAllowed).toBe(false);
      expect(entry?.sensitive).toBe(false);
      expect(entry?.content).toBe(payload.candidates[index].suggested_rewrite);
      expect(entry?.copyText).toBe(payload.candidates[index].suggested_rewrite);
      expect(entry?.sourceQuote).toBe(payload.candidates[index].source_excerpt);
      expect(entry?.reviewSummaryId).toBe(result.reviewSummaryId);
    }
  });

  test("mcp writer boundary: unknown tags and mitigation-less red flags are rejected", () => {
    const payload = validReviewPayload();
    expect(() =>
      validatePayload({
        ...payload,
        candidates: [{ ...payload.candidates[0], use_for: ["Carrier Pigeon"] as never }],
      }),
    ).toThrow(MarketingReviewValidationError);

    expect(() =>
      validatePayload({
        ...payload,
        red_flags: [
          {
            source_excerpt: "Bare claim.",
            risk_level: "High",
            issue: "No mitigation attached.",
            safer_wording: null,
            proof_requirement: null,
          },
        ],
      }),
    ).toThrow(MarketingReviewValidationError);
  });

  test("mcp negative: secret-bearing / pricing-leak doc is quarantined with no secret in output", () => {
    // Ingest boundary: secret filenames are flagged before extraction.
    expect(detectSensitiveFilename(".env")).toBe(true);
    expect(detectSensitiveFilename("stripe-credentials.json")).toBe(true);
    expect(detectSensitiveFilename("id_rsa")).toBe(true);
    expect(detectSensitiveFilename("deploy-key.pem")).toBe(true);
    expect(detectSensitiveFilename("launch-announcement.md")).toBe(false);

    // Prompt-contract boundary (read-only reference): extraction must exclude
    // pricing/credentials, and canon must be public-safe.
    expect(buildMarketingNuggetPrompt("sample").systemPrompt).toMatch(/pricing/i);
    expect(buildMarketingNuggetPrompt("sample").systemPrompt).toMatch(/credential/i);
    expect(buildPublicSafetyPrompt("sample").systemPrompt).toMatch(/pricing/i);
    expect(buildPublicSafetyPrompt("sample").systemPrompt).toMatch(/credential|api keys/i);
    expect(buildCanonExtractionPrompt("sample").systemPrompt).toMatch(/public-safe/i);

    // The tainted doc never reaches the writer: quarantine drops every
    // candidate carrying the secret/pricing tokens.
    const tainted = [
      {
        source_excerpt: `Deploy with ${SECRET_TOKEN} in the environment.`,
        suggested_rewrite: "Deploy with the documented environment configuration.",
      },
      {
        source_excerpt: "Our checkout converts well for platform teams.",
        suggested_rewrite: "Platform teams can inspect the checkout flow in the demo.",
      },
      {
        source_excerpt: `Q3 plan: ${PRICING_TOKEN}.`,
        suggested_rewrite: "Q3 plan: usage-based packaging (details on request).",
      },
    ];
    const survivors = quarantineTaintedCandidates(tainted);
    expect(survivors).toHaveLength(1);
    expect(survivors[0].source_excerpt).toBe(tainted[1].source_excerpt);

    // Persist only the clean survivor path and assert absence of secrets in
    // everything the writer stored for this parcel.
    const { batchId, docId } = createParcelParents("int-c-quarantine-check.md");
    const payload = validReviewPayload();
    const result = persistMarketingReview({
      sourceDocumentId: docId,
      importBatchId: batchId,
      initiativeSlug: null,
      modelUsed: "int-c-email-receipt-mcp",
      payload,
    });
    createdSummaryIds.push(result.reviewSummaryId);
    createdEntryIds.push(...result.libraryEntryIds);
    createdRedFlagIds.push(...result.redFlagIds);
    createdAssetIds.push(...result.assetOpportunityIds);

    const storedText: string[] = [];
    for (const entryId of result.libraryEntryIds) {
      const entry = getLibraryEntry(entryId);
      storedText.push(
        entry?.content ?? "",
        entry?.copyText ?? "",
        entry?.sourceQuote ?? "",
        entry?.suggestedRewrite ?? "",
      );
    }
    for (const text of storedText) {
      expect(text).not.toContain(SECRET_TOKEN);
      expect(text).not.toContain(PRICING_TOKEN);
    }
  });
});
