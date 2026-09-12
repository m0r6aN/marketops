import { describe, expect, test } from "vitest";

import { getClaimHygieneSummary } from "@/lib/claims";
import type { Initiative } from "@/lib/initiatives";
import adversarialFixtures from "./fixtures/adversarial.json";

// Claim safety eval harness (parcel w1-claim-eval-harness).
//
// Characterizes CURRENT behavior only. No behavior flip, no threshold choice.
//
// Current behavior noted from source reads:
// - src/lib/claims.ts uses literal-includes(): each rule text is trimmed; an
//   empty rule never matches; otherwise text.toLowerCase().includes(
//   ruleText.toLowerCase()). There is no paraphrase, semantic, word-boundary,
//   negation, or scoping logic. getClaimHygieneSummary() returns
//   { banned, needsProof, clean } where clean means both lists are empty.
// - src/lib/persuasion-review/service.ts issueFlags() maps any non-empty
//   claimFindings array to a single blocked "unsupported-claim" flag, and
//   buildPersuasionReview() marks affected assessments blocked when any flag
//   is blocked. This harness reports the claims-layer verdicts that feed that
//   flag; it does not execute the persuasion-review DB path so the harness
//   stays deterministic and side-effect free.
//
// Harness-side verdict mapping (reporting convention only, not a product
// threshold): banned.length > 0 => "blocked"; else needsProof.length > 0 =>
// "needs-proof"; else "safe". This mirrors the ClaimEval contract verdict enum
// ("safe" | "needs-proof" | "blocked") and the content-workspace handling
// convention ("avoid" => blocked, "needs-proof" => needs-proof).
//
// Limitation: no embeddings or semantic-similarity library is present in
// devDependencies, and the parcel forbids new dependencies. The harness is
// therefore built on string/paraphrase fixtures versus current verdicts. It
// measures literal-match evasion (paraphrase-flip rate), not embedding
// similarity.

type ClaimVerdict = "blocked" | "needs-proof" | "safe";
type FixtureCategory = "paraphrase-attack" | "superlative" | "scoped-safe";

type AdversarialFixture = {
  id: string;
  groupId: string;
  category: FixtureCategory;
  variant: string;
  text: string;
  source: string;
  note: string;
};

type EvalResult = {
  id: string;
  groupId: string;
  category: FixtureCategory;
  variant: string;
  text: string;
  verdict: ClaimVerdict;
  bannedMatches: string[];
  needsProofMatches: string[];
  clean: boolean;
};

type VerdictCounts = Record<ClaimVerdict, number>;

type EvalMetrics = {
  total: number;
  counts: VerdictCounts;
  byCategory: Record<FixtureCategory, VerdictCounts>;
  groupsEvaluated: number;
  comparisons: number;
  flipped: number;
  paraphraseFlipRate: number;
  groupsWithFlip: number;
};

// Eval initiative with representative banned / needs-proof rules mirroring the
// in-repo seed canon (Keon, BioStack, SilentApply). Kept inline so the harness
// is self-contained and does not touch the SQLite repository layer.
const EVAL_INITIATIVE: Initiative = {
  slug: "claim-eval-harness",
  name: "Claim eval harness",
  category: "Eval",
  stage: { key: "concept", label: "Concept" },
  status: { key: "early-build", label: "Early build" },
  oneLiner: "Self-contained initiative for characterizing literal claim matching.",
  primaryAudiences: [{ label: "Operator" }],
  primaryCta: "Review metrics",
  currentMarketingFocus: "Claim safety characterization",
  allowedClaims: [
    { text: "supplement stack organization" },
    { text: "organize supplement protocol patterns" },
  ],
  bannedClaims: [
    { text: "most powerful autonomous AI" },
    { text: "guaranteed job offers" },
    { text: "medical advice" },
    { text: "diagnosis" },
    { text: "proves all AI actions are safe" },
  ],
  needsProofClaims: [
    { text: "production Runtime enforcement" },
    { text: "live policy checks" },
    { text: "interaction intelligence" },
    { text: "application quality scoring" },
  ],
  claimPosture: "Characterize literal matching; no threshold decision.",
  narrative: "Harness-only initiative.",
  toneNotes: "N/A",
  needsPositioningReview: false,
  isActive: true,
};

const fixtures = adversarialFixtures as AdversarialFixture[];

function toVerdict(bannedCount: number, needsProofCount: number): ClaimVerdict {
  if (bannedCount > 0) return "blocked";
  if (needsProofCount > 0) return "needs-proof";
  return "safe";
}

function evaluateAll(): EvalResult[] {
  return fixtures.map((fixture) => {
    const summary = getClaimHygieneSummary(EVAL_INITIATIVE, fixture.text);
    return {
      id: fixture.id,
      groupId: fixture.groupId,
      category: fixture.category,
      variant: fixture.variant,
      text: fixture.text,
      verdict: toVerdict(summary.banned.length, summary.needsProof.length),
      bannedMatches: summary.banned.map((rule) => rule.text),
      needsProofMatches: summary.needsProof.map((rule) => rule.text),
      clean: summary.clean,
    };
  });
}

function zeroCounts(): VerdictCounts {
  return { blocked: 0, "needs-proof": 0, safe: 0 };
}

function computeMetrics(results: EvalResult[]): EvalMetrics {
  const counts = zeroCounts();
  const byCategory: Record<FixtureCategory, VerdictCounts> = {
    "paraphrase-attack": zeroCounts(),
    superlative: zeroCounts(),
    "scoped-safe": zeroCounts(),
  };
  for (const result of results) {
    counts[result.verdict] += 1;
    byCategory[result.category][result.verdict] += 1;
  }

  const byGroup = new Map<string, EvalResult[]>();
  for (const result of results) {
    const group = byGroup.get(result.groupId) ?? [];
    group.push(result);
    byGroup.set(result.groupId, group);
  }

  let comparisons = 0;
  let flipped = 0;
  let groupsWithFlip = 0;
  for (const group of byGroup.values()) {
    const baseline = group.find((item) => item.variant === "original");
    if (!baseline) continue;
    let groupFlipped = false;
    for (const item of group) {
      if (item.variant === "original") continue;
      comparisons += 1;
      if (item.verdict !== baseline.verdict) {
        flipped += 1;
        groupFlipped = true;
      }
    }
    if (groupFlipped) groupsWithFlip += 1;
  }

  return {
    total: results.length,
    counts,
    byCategory,
    groupsEvaluated: byGroup.size,
    comparisons,
    flipped,
    paraphraseFlipRate: comparisons === 0 ? 0 : flipped / comparisons,
    groupsWithFlip,
  };
}

const results = evaluateAll();
const metrics = computeMetrics(results);

function report(): void {
  // REPORT-ONLY output: counts per verdict + paraphrase-flip rate. Numbers are
  // reported for product sign-off; no threshold is asserted anywhere.
  console.log("[claim-eval-harness] metrics:", JSON.stringify(metrics, null, 2));
  console.log("[claim-eval-harness] results:", JSON.stringify(results, null, 2));
}

describe("claim-eval harness", () => {
  test("harness evaluates every adversarial fixture", () => {
    expect(Array.isArray(fixtures)).toBe(true);
    expect(results).toHaveLength(fixtures.length);

    const fixtureIds = new Set(fixtures.map((fixture) => fixture.id));
    const resultIds = new Set(results.map((result) => result.id));
    expect(resultIds).toEqual(fixtureIds);

    for (const result of results) {
      expect(["blocked", "needs-proof", "safe"]).toContain(result.verdict);
      expect(Array.isArray(result.bannedMatches)).toBe(true);
      expect(Array.isArray(result.needsProofMatches)).toBe(true);
      expect(result.clean).toBe(
        result.bannedMatches.length === 0 && result.needsProofMatches.length === 0,
      );
      expect(result.clean).toBe(result.verdict === "safe");
      expect(typeof result.text).toBe("string");
      expect(result.text.length).toBeGreaterThan(0);
    }
  });

  test("metrics object is complete and internally consistent", () => {
    expect(metrics.total).toBe(fixtures.length);
    expect(typeof metrics.counts.blocked).toBe("number");
    expect(typeof metrics.counts["needs-proof"]).toBe("number");
    expect(typeof metrics.counts.safe).toBe("number");
    expect(
      metrics.counts.blocked + metrics.counts["needs-proof"] + metrics.counts.safe,
    ).toBe(metrics.total);

    for (const category of ["paraphrase-attack", "superlative", "scoped-safe"] as const) {
      const bucket = metrics.byCategory[category];
      expect(typeof bucket.blocked).toBe("number");
      expect(typeof bucket["needs-proof"]).toBe("number");
      expect(typeof bucket.safe).toBe("number");
    }
    const bucketTotals =
      metrics.byCategory["paraphrase-attack"].blocked +
      metrics.byCategory["paraphrase-attack"]["needs-proof"] +
      metrics.byCategory["paraphrase-attack"].safe +
      metrics.byCategory.superlative.blocked +
      metrics.byCategory.superlative["needs-proof"] +
      metrics.byCategory.superlative.safe +
      metrics.byCategory["scoped-safe"].blocked +
      metrics.byCategory["scoped-safe"]["needs-proof"] +
      metrics.byCategory["scoped-safe"].safe;
    expect(bucketTotals).toBe(metrics.total);

    expect(metrics.groupsEvaluated).toBeGreaterThan(0);
    expect(metrics.comparisons).toBeGreaterThan(0);
    expect(metrics.flipped).toBeGreaterThanOrEqual(0);
    expect(metrics.flipped).toBeLessThanOrEqual(metrics.comparisons);
    expect(metrics.paraphraseFlipRate).toBeGreaterThanOrEqual(0);
    expect(metrics.paraphraseFlipRate).toBeLessThanOrEqual(1);
    expect(metrics.groupsWithFlip).toBeGreaterThanOrEqual(0);
    expect(metrics.groupsWithFlip).toBeLessThanOrEqual(metrics.groupsEvaluated);
  });

  test("fixture set covers required adversarial categories", () => {
    const categories = new Set(fixtures.map((fixture) => fixture.category));
    expect(categories.has("paraphrase-attack")).toBe(true);
    expect(categories.has("superlative")).toBe(true);
    expect(categories.has("scoped-safe")).toBe(true);

    const ids = fixtures.map((fixture) => fixture.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const fixture of fixtures) {
      expect(typeof fixture.id).toBe("string");
      expect(fixture.id.length).toBeGreaterThan(0);
      expect(typeof fixture.groupId).toBe("string");
      expect(fixture.groupId.length).toBeGreaterThan(0);
      expect(typeof fixture.text).toBe("string");
      expect(fixture.text.length).toBeGreaterThan(0);
      expect(typeof fixture.source).toBe("string");
      expect(fixture.source.length).toBeGreaterThan(0);
    }

    const perGroup = new Map<string, number>();
    for (const fixture of fixtures) {
      perGroup.set(fixture.groupId, (perGroup.get(fixture.groupId) ?? 0) + 1);
    }
    expect(perGroup.size).toBe(metrics.groupsEvaluated);
    for (const count of perGroup.values()) {
      expect(count).toBeGreaterThanOrEqual(2);
    }
  });

  test("reports metrics without threshold assertions", () => {
    report();
    expect(metrics.total).toBe(results.length);
  });
});
