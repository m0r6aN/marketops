/**
 * Docs-as-marketing-review — persistence writer.
 *
 * Consumes the `DocsAsMarketingReviewPayload` produced by the
 * docs-as-marketing-review skill (mode: "persist") and writes it across the
 * four Library tables in a single SQLite transaction. Implements the
 * "Persistence Contract" documented in
 * `.claude/skills/docs-as-marketing-review/SKILL.md`.
 *
 * Hard rules enforced here (not in SQL):
 *   - Every tag value must be in the allowed set; unknown tag → throw, rollback.
 *   - Every red flag must carry safer_wording OR proof_requirement.
 *   - IDs are minted here, never accepted from the caller payload.
 *   - Re-runs against the same source_document_id insert a new review summary
 *     rather than mutating in place — history is preserved.
 */
import {
  createMarketingReviewSummary,
  createMarketingRedFlag,
  createMarketingAssetOpportunity,
  createLibraryEntry,
  withTransaction,
} from "@/lib/library/repository";
import type {
  DocsAsMarketingReviewPayload,
  MarketingReviewPersistResult,
  MarketingUseFor,
  MarketingAudience,
  MarketingFunnelStage,
  MarketingContentType,
  MarketingReviewConfidence,
  MarketingProofStrength,
  MarketingClaimRisk,
  MarketingAssetPriority,
} from "@/lib/library/types";
import { MARKETING_REVIEW_RUBRIC_VERSION } from "@/lib/library/types";

// ── Allowed tag sets (must match the skill's "Allowed Tag Values") ───────────

const USE_FOR: ReadonlySet<MarketingUseFor> = new Set<MarketingUseFor>([
  "Website", "Landing Page", "Blog", "SEO",
  "Social Media", "LinkedIn", "X / Twitter",
  "Email", "Newsletter",
  "Sales Deck", "Investor Deck",
  "Webinar", "Demo Script", "Product Tour",
  "FAQ", "Knowledge Hub", "Case Study",
  "One-Pager", "Whitepaper", "Press / Launch",
  "Documentation Link-Back",
]);

const AUDIENCE: ReadonlySet<MarketingAudience> = new Set<MarketingAudience>([
  "Developer", "Platform Team", "Security Team", "Compliance Team",
  "Executive", "Founder", "Buyer", "Operator",
  "Auditor", "Partner", "Investor",
]);

const FUNNEL_STAGE: ReadonlySet<MarketingFunnelStage> =
  new Set<MarketingFunnelStage>([
    "Awareness", "Education", "Consideration", "Conversion",
    "Activation", "Retention", "Expansion",
    "Trust Building", "Objection Handling",
  ]);

const CONTENT_TYPE: ReadonlySet<MarketingContentType> =
  new Set<MarketingContentType>([
    "Problem Statement", "Product Positioning", "Feature", "Benefit",
    "Proof Point", "Differentiator", "Customer Outcome",
    "Technical Explanation", "Architecture Principle", "Integration",
    "Benchmark", "FAQ", "Glossary", "Tutorial", "Comparison",
    "Objection", "Risk Reduction",
    "Quote Candidate", "Hook", "CTA Candidate",
  ]);

const REVIEW_CONFIDENCE: ReadonlySet<MarketingReviewConfidence> =
  new Set<MarketingReviewConfidence>([
    "Use As-Is", "Light Rewrite", "Heavy Rewrite",
    "Needs Proof", "Needs Version Check", "Roadmap Only",
    "Internal Only", "Do Not Use",
  ]);

const PROOF_STRENGTH: ReadonlySet<MarketingProofStrength> =
  new Set<MarketingProofStrength>(["Strong", "Medium", "Weak", "Unsupported"]);

const CLAIM_RISK: ReadonlySet<MarketingClaimRisk> =
  new Set<MarketingClaimRisk>(["Low", "Medium", "High"]);

const PRIORITY: ReadonlySet<MarketingAssetPriority> =
  new Set<MarketingAssetPriority>(["High", "Medium", "Low"]);

// ── Errors ───────────────────────────────────────────────────────────────────

export class MarketingReviewValidationError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = "MarketingReviewValidationError";
  }
}

function assertTag<T>(
  set: ReadonlySet<T>,
  value: unknown,
  label: string
): asserts value is T {
  if (!set.has(value as T)) {
    throw new MarketingReviewValidationError(
      `Unknown ${label} tag: ${JSON.stringify(value)}`
    );
  }
}

function assertTagArray<T>(
  set: ReadonlySet<T>,
  values: unknown,
  label: string
): asserts values is T[] {
  if (!Array.isArray(values)) {
    throw new MarketingReviewValidationError(`${label} must be an array`);
  }
  for (const v of values) assertTag(set, v, label);
}

function deriveTitle(marketingAngle: string, sourceSection: string): string {
  const seed = (marketingAngle || sourceSection || "Marketing candidate").trim();
  return seed.length <= 80 ? seed : `${seed.slice(0, 77)}…`;
}

// ── Public API ───────────────────────────────────────────────────────────────

export type PersistInput = {
  sourceDocumentId: string;
  importBatchId: string;
  initiativeSlug?: string | null;
  modelUsed?: string | null;
  payload: DocsAsMarketingReviewPayload;
};

/**
 * Validate the payload's tag values *before* opening a transaction.
 * Throws MarketingReviewValidationError on any unknown tag or rule violation.
 */
export function validatePayload(payload: DocsAsMarketingReviewPayload): void {
  if (
    typeof payload?.summary?.overall_score !== "number" ||
    payload.summary.overall_score < 0 ||
    payload.summary.overall_score > 100
  ) {
    throw new MarketingReviewValidationError(
      "summary.overall_score must be an integer 0–100"
    );
  }
  assertTagArray(USE_FOR, payload.summary.best_marketing_uses, "use_for");

  for (const [i, c] of payload.candidates.entries()) {
    const at = (field: string) => `candidates[${i}].${field}`;
    if (!c.source_excerpt?.trim()) {
      throw new MarketingReviewValidationError(`${at("source_excerpt")} is required`);
    }
    assertTagArray(USE_FOR, c.use_for, at("use_for"));
    assertTagArray(AUDIENCE, c.audience, at("audience"));
    assertTag(FUNNEL_STAGE, c.funnel_stage, at("funnel_stage"));
    assertTagArray(CONTENT_TYPE, c.content_type, at("content_type"));
    assertTag(REVIEW_CONFIDENCE, c.confidence, at("confidence"));
    assertTag(PROOF_STRENGTH, c.proof_strength, at("proof_strength"));
    assertTag(CLAIM_RISK, c.claim_risk, at("claim_risk"));
  }

  for (const [i, f] of payload.red_flags.entries()) {
    assertTag(CLAIM_RISK, f.risk_level, `red_flags[${i}].risk_level`);
    if (!f.safer_wording && !f.proof_requirement) {
      throw new MarketingReviewValidationError(
        `red_flags[${i}] must include safer_wording or proof_requirement`
      );
    }
  }

  for (const [i, a] of payload.asset_opportunities.entries()) {
    if (!a.asset_type?.trim() || !a.theme?.trim()) {
      throw new MarketingReviewValidationError(
        `asset_opportunities[${i}] requires asset_type and theme`
      );
    }
    assertTag(PRIORITY, a.priority, `asset_opportunities[${i}].priority`);
  }
}

/**
 * Persist a docs-as-marketing-review skill payload across all four tables.
 * Returns the IDs of every row inserted. Rolls back the whole transaction on
 * any validation or insert failure.
 */
export function persistMarketingReview(
  input: PersistInput
): MarketingReviewPersistResult {
  validatePayload(input.payload);

  return withTransaction(() => {
    const summary = createMarketingReviewSummary({
      sourceDocumentId: input.sourceDocumentId,
      importBatchId: input.importBatchId,
      overallScore: Math.round(input.payload.summary.overall_score),
      bestMarketingUses: input.payload.summary.best_marketing_uses,
      highestValueTheme: input.payload.summary.highest_value_theme,
      rubricVersion: MARKETING_REVIEW_RUBRIC_VERSION,
    });

    const libraryEntryIds: string[] = [];
    for (const c of input.payload.candidates) {
      const entry = createLibraryEntry({
        sourceDocumentId: input.sourceDocumentId,
        importBatchId: input.importBatchId,
        initiativeSlug: input.initiativeSlug ?? null,
        entryType: "marketing_nugget",
        title: deriveTitle(c.marketing_angle, c.source_section),
        content: c.suggested_rewrite,
        summary: null,
        visibility: "private",
        status: "candidate",
        tags: [],
        confidenceScore: 0,
        memoryValueScore: 0,
        publicSafe: false,
        sensitive: false,
        // Mirror the excerpt/rewrite onto the legacy columns so existing
        // readers (review-card, marketing-nugget-card) keep rendering.
        sourceQuote: c.source_excerpt,
        sourceLocation: c.source_section,
        modelUsed: input.modelUsed ?? null,
        canonCategory: null,
        canonicalStatement: null,
        locked: false,
        conflictStatus: null,
        publicAutomationAllowed: false,
        copyText: c.suggested_rewrite,
        suggestedChannel: c.use_for[0] ?? null,
        suggestedUse: null,
        emotionalAngle: null,
        audience: null,
        approvedForAutomation: false,
        internalCategory: null,
        sensitivityLevel: null,
        whyItMatters: null,
        reviewPriority: null,
        reviewedBy: null,
        reviewedAt: null,
        // Review-skill columns
        sourceSection: c.source_section,
        sourceExcerpt: c.source_excerpt,
        marketingAngle: c.marketing_angle,
        suggestedRewrite: c.suggested_rewrite,
        useFor: c.use_for,
        reviewAudience: c.audience,
        funnelStage: c.funnel_stage,
        contentType: c.content_type,
        reviewConfidence: c.confidence,
        proofStrength: c.proof_strength,
        claimRisk: c.claim_risk,
        linkBackRequired: Boolean(c.link_back_required),
        reviewSummaryId: summary.id,
        rubricVersion: MARKETING_REVIEW_RUBRIC_VERSION,
      });
      libraryEntryIds.push(entry.id);
    }

    const redFlagIds = input.payload.red_flags.map((f) =>
      createMarketingRedFlag({
        sourceDocumentId: input.sourceDocumentId,
        reviewSummaryId: summary.id,
        libraryEntryId: null, // skill payload doesn't link flags to candidates
        sourceExcerpt: f.source_excerpt,
        riskLevel: f.risk_level,
        issue: f.issue,
        saferWording: f.safer_wording ?? null,
        proofRequirement: f.proof_requirement ?? null,
      }).id
    );

    const assetOpportunityIds = input.payload.asset_opportunities.map((a) =>
      createMarketingAssetOpportunity({
        sourceDocumentId: input.sourceDocumentId,
        reviewSummaryId: summary.id,
        assetType: a.asset_type,
        theme: a.theme,
        priority: a.priority,
        status: "proposed",
      }).id
    );

    return {
      reviewSummaryId: summary.id,
      libraryEntryIds,
      redFlagIds,
      assetOpportunityIds,
    };
  });
}
