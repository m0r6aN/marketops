/**
 * Narrow adapter the docs_as_marketing_review tool uses to delegate the
 * actual review to an LLM. Tool logic stays separate from any provider so
 * that swapping models is a one-file change.
 */
import type {
  AssetOpportunity,
  Candidate,
  DocsAsMarketingInput,
  DocsAsMarketingOutput,
  RedFlag,
} from "../types.js";

export interface LlmReviewClient {
  /** Stable identifier surfaced in logs and tool metadata. */
  readonly providerId: string;

  /**
   * Run the docs-as-marketing review against `input` and return a payload
   * matching the output schema. Implementations MUST:
   *   - Treat `document_text` as authoritative; never import outside facts.
   *   - Respect the rubric's allowed-tag sets.
   *   - Flag every roadmap statement as `Roadmap Only` confidence.
   *   - Attach `safer_wording` or `proof_requirement` to every red flag.
   *   - Never fabricate source excerpts.
   */
  review(input: DocsAsMarketingInput): Promise<DocsAsMarketingOutput>;
}

// ── Mock implementation ────────────────────────────────────────────────────
//
// Deterministic, rubric-aware extraction. Not a real LLM. It exists so that
// the MCP server boots, tests run, and Docker `docker run` produces a
// useful-shaped response without requiring an API key.
//
// Rules it actually enforces:
//   - Sentences with roadmap markers ("planned", "will ship", "coming soon",
//     "we are building", "roadmap", "in beta") → Roadmap Only candidate +
//     Medium red flag.
//   - Sentences with risky absolutes ("secure", "compliant", "verified",
//     "proven", "production-ready", "certified", "audited", "guaranteed",
//     "always", "never") without numeric proof → High red flag.
//   - Sentences with concrete numbers / measurements → Strong proof candidate.
//   - Everything else with "we" / "our" framing → Medium proof candidate.

const ROADMAP_PATTERNS = [
  /\broadmap\b/i,
  /\bwe are\s+(?:\w+\s+){0,3}building\b/i,
  /\bwe'?re\s+(?:\w+\s+){0,3}building\b/i,
  /\bcoming soon\b/i,
  /\bwill ship\b/i,
  /\bships?\s+in\s+Q\d\b/i,
  /\bfirst version\b/i,
  /\bwill be (?:released|available|added)\b/i,
  /\bin beta\b/i,
  /\bplanned for\b/i,
  /\b(?:next|upcoming) (?:quarter|release|version)\b/i,
];

const RISKY_WORDS = [
  "secure",
  "compliant",
  "verified",
  "proven",
  "production-ready",
  "certified",
  "audited",
  "guaranteed",
];

const ABSOLUTES = [/\balways\b/i, /\bnever\b/i, /\b100%\b/i];

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z])/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function hasAny(s: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(s));
}

function containsRiskyWord(s: string): string | null {
  const lower = s.toLowerCase();
  for (const w of RISKY_WORDS) {
    if (lower.includes(w)) return w;
  }
  return null;
}

function hasNumericProof(s: string): boolean {
  return /\b\d+(?:\.\d+)?\s*(?:%|ms|s|x|×|req\/s|qps|GB|MB|users?|customers?)\b/i.test(
    s
  );
}

export class MockLlmReviewClient implements LlmReviewClient {
  readonly providerId = "mock";

  async review(input: DocsAsMarketingInput): Promise<DocsAsMarketingOutput> {
    const sentences = splitSentences(input.document_text);
    const candidates: Candidate[] = [];
    const redFlags: RedFlag[] = [];

    for (const [i, sentence] of sentences.entries()) {
      const section = `Sentence ${i + 1}`;
      const isRoadmap = hasAny(sentence, ROADMAP_PATTERNS);
      const riskyWord = containsRiskyWord(sentence);
      const isAbsolute = hasAny(sentence, ABSOLUTES);
      const hasProof = hasNumericProof(sentence);

      if (isRoadmap) {
        candidates.push({
          source_section: section,
          source_excerpt: sentence,
          marketing_angle: "Roadmap signal — not currently shipping",
          suggested_rewrite: `Designed to ${sentence
            .replace(/^we (?:are|'re) building /i, "")
            .replace(/^we will /i, "")
            .replace(/^planned for /i, "ship ")}`,
          use_for: ["Documentation Link-Back"],
          audience: ["Buyer"],
          funnel_stage: "Education",
          content_type: ["Product Positioning"],
          confidence: "Roadmap Only",
          proof_strength: "Weak",
          claim_risk: "Medium",
          link_back_required: true,
        });
        redFlags.push({
          source_excerpt: sentence,
          risk_level: "Medium",
          issue: "Roadmap language — risk of being quoted as a current capability.",
          safer_wording: `Designed to ${sentence
            .replace(/^we (?:are|'re) building /i, "")
            .replace(/^we will /i, "")}`,
          proof_requirement:
            "Do not present as current capability until shipped; link to release notes once available.",
        });
        continue;
      }

      if (riskyWord && !hasProof) {
        redFlags.push({
          source_excerpt: sentence,
          risk_level: "High",
          issue: `Uses "${riskyWord}" without supporting evidence in the source.`,
          safer_wording: sentence.replace(
            new RegExp(`\\b${riskyWord}\\b`, "i"),
            `designed to be ${riskyWord}`
          ),
          proof_requirement:
            "Cite a benchmark, audit report, or third-party attestation before using in conversion copy.",
        });
        // Still extract as a candidate, but mark as Needs Proof.
        candidates.push({
          source_section: section,
          source_excerpt: sentence,
          marketing_angle: `Trust claim around "${riskyWord}" — verify before promoting`,
          suggested_rewrite: sentence,
          use_for: ["Documentation Link-Back"],
          audience: ["Security Team"],
          funnel_stage: "Trust Building",
          content_type: ["Risk Reduction"],
          confidence: "Needs Proof",
          proof_strength: "Unsupported",
          claim_risk: "High",
          link_back_required: true,
        });
        continue;
      }

      if (isAbsolute && !hasProof) {
        redFlags.push({
          source_excerpt: sentence,
          risk_level: "Medium",
          issue: "Uses an absolute (always/never/100%) without verification artifact.",
          safer_wording: sentence.replace(
            /\b(always|never|100%)\b/i,
            (m) => `designed to ${m.toLowerCase()}`
          ),
          proof_requirement:
            "Add a test, fixture, or benchmark link before publishing.",
        });
      }

      candidates.push({
        source_section: section,
        source_excerpt: sentence,
        marketing_angle: `Positioning candidate from ${section.toLowerCase()}`,
        suggested_rewrite: sentence,
        use_for: hasProof ? ["Landing Page", "Sales Deck"] : ["Blog", "Documentation Link-Back"],
        audience: input.target_audience
          .map(mapAudience)
          .filter((a): a is NonNullable<typeof a> => a !== null)
          .slice(0, 3),
        funnel_stage: hasProof ? "Conversion" : "Education",
        content_type: hasProof
          ? ["Proof Point"]
          : ["Technical Explanation"],
        confidence: hasProof ? "Light Rewrite" : "Heavy Rewrite",
        proof_strength: hasProof ? "Strong" : "Medium",
        claim_risk: isAbsolute ? "Medium" : "Low",
        link_back_required: hasProof,
      });
    }

    // Guarantee at least one audience entry per candidate so we satisfy the
    // output schema even if the caller's target_audience list is exotic.
    for (const c of candidates) {
      if (c.audience.length === 0) c.audience = ["Buyer"];
    }

    const opportunities: AssetOpportunity[] = [];
    if (candidates.some((c) => c.use_for.includes("Landing Page"))) {
      opportunities.push({
        asset_type: "Landing Page Hero",
        theme: input.review_goal || "Lead with the strongest proof",
        priority: "High",
      });
    }
    if (redFlags.some((f) => f.risk_level === "High")) {
      opportunities.push({
        asset_type: "Knowledge Hub Article",
        theme: "Substantiate trust claims with proof links",
        priority: "Medium",
      });
    }
    if (candidates.some((c) => c.confidence === "Roadmap Only")) {
      opportunities.push({
        asset_type: "Internal Note",
        theme: "Roadmap claims to revisit once shipped",
        priority: "Low",
      });
    }
    if (opportunities.length === 0) {
      opportunities.push({
        asset_type: "Blog Post",
        theme: input.source_title,
        priority: "Medium",
      });
    }

    const usedFor = new Set<Candidate["use_for"][number]>();
    for (const c of candidates) for (const u of c.use_for) usedFor.add(u);
    const bestMarketingUses = Array.from(usedFor).slice(0, 5);

    const overallScore = computeOverallScore(candidates, redFlags);

    return {
      summary: {
        best_marketing_uses: bestMarketingUses,
        overall_score: overallScore,
        highest_value_theme:
          candidates.find((c) => c.proof_strength === "Strong")?.marketing_angle ??
          candidates[0]?.marketing_angle ??
          null,
      },
      candidates,
      red_flags: redFlags,
      asset_opportunities: opportunities,
    };
  }
}

function computeOverallScore(
  candidates: Candidate[],
  redFlags: RedFlag[]
): number {
  if (candidates.length === 0) return 0;
  const strong = candidates.filter((c) => c.proof_strength === "Strong").length;
  const medium = candidates.filter((c) => c.proof_strength === "Medium").length;
  const high = redFlags.filter((f) => f.risk_level === "High").length;
  const med = redFlags.filter((f) => f.risk_level === "Medium").length;
  const raw =
    40 +
    strong * 12 +
    medium * 6 -
    high * 18 -
    med * 6;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

const AUDIENCE_ALIASES: Record<string, Candidate["audience"][number]> = {
  developer: "Developer",
  developers: "Developer",
  "platform team": "Platform Team",
  "platform engineer": "Platform Team",
  "security team": "Security Team",
  "security engineer": "Security Team",
  "compliance team": "Compliance Team",
  cto: "Executive",
  ceo: "Executive",
  cfo: "Executive",
  executive: "Executive",
  founder: "Founder",
  buyer: "Buyer",
  operator: "Operator",
  auditor: "Auditor",
  partner: "Partner",
  investor: "Investor",
};

function mapAudience(input: string): Candidate["audience"][number] | null {
  const key = input.trim().toLowerCase();
  return AUDIENCE_ALIASES[key] ?? null;
}
