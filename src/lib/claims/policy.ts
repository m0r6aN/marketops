/**
 * w2-claim-approval-wire — strict claim publication-gate policy (pure layer).
 *
 * RULING (already made — do not relitigate, do not soften):
 * - Confirmed violations block publication/apply.
 * - Uncertainty, missing evidence, and evaluation failures route to
 *   needs-review (fail-closed).
 * - NEITHER blocked NOR needs-review permits publication/apply.
 * - Approve/apply only after evidence + policy checks pass AND required
 *   operator approvals are recorded.
 * - Every decision logs evidence refs, the policy version, and the decision
 *   rationale.
 *
 * SCOPE: this module is a pure function over the READ-ONLY matchers in
 * src/lib/claims.ts (getBannedClaimMatches / getNeedsProofClaimMatches). It
 * introduces no new matching behavior and changes none.
 *
 * DEFENSIVE NOTES (w1 harness metrics — negation blindness, layer gap):
 * - The underlying matchers are literal case-insensitive substring checks
 *   with no negation, paraphrase, or scope handling. A negated banned phrase
 *   ("we do NOT offer <banned>") still matches, and a reworded claim still
 *   evades. Both limitations fail CLOSED here: literal hits always escalate
 *   (blocked / needs-review), and the absence of a match only yields "safe"
 *   from this literal layer — downstream approval + evidence checks remain
 *   mandatory before any apply. Never add semantic downgrades in this file.
 * - Attached evidence NEVER downgrades a needs-proof verdict to safe on its
 *   own. Evidence is a prerequisite for a later operator approval (checked at
 *   the apply gate in persuasion-review/service.ts), not a substitute for it.
 */

import {
  getBannedClaimMatches,
  getNeedsProofClaimMatches,
} from "@/lib/claims";
import type { Initiative } from "@/lib/initiatives/types";

/** Canonical version stamped on every claim-gate decision receipt. */
export const CLAIM_POLICY_VERSION = "claim-policy.v1" as const;

export type ClaimPolicyVerdict = "blocked" | "needs-review" | "safe";

export type ClaimPolicyInput = {
  initiative: Initiative | null | undefined;
  text: unknown;
  evidenceRefs?: unknown;
};

export type ClaimPolicyEvaluation = {
  verdict: ClaimPolicyVerdict;
  policyVersion: typeof CLAIM_POLICY_VERSION;
  bannedMatches: string[];
  needsProofMatches: string[];
  evidenceRefs: string[];
  rationale: string;
};

function normalizeEvidenceRefs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is string =>
        typeof entry === "string" && entry.trim().length > 0,
    )
    .map((entry) => entry.trim());
}

function hasRuleLists(
  initiative: Initiative | null | undefined,
): initiative is Initiative {
  return (
    typeof initiative === "object" &&
    initiative !== null &&
    Array.isArray(initiative.bannedClaims) &&
    Array.isArray(initiative.needsProofClaims)
  );
}

/**
 * Full strict evaluation. Pure: no I/O, no matcher changes, never throws —
 * every uncertainty becomes needs-review with an explanatory rationale.
 */
export function evaluateClaimDetailed(
  input: ClaimPolicyInput,
): ClaimPolicyEvaluation {
  const evidenceRefs = normalizeEvidenceRefs(input?.evidenceRefs);
  const failClosed = (
    rationale: string,
  ): ClaimPolicyEvaluation => ({
    verdict: "needs-review",
    policyVersion: CLAIM_POLICY_VERSION,
    bannedMatches: [],
    needsProofMatches: [],
    evidenceRefs,
    rationale: `${rationale} [${CLAIM_POLICY_VERSION}]`,
  });

  if (!input || !hasRuleLists(input.initiative)) {
    return failClosed(
      "Claim rule set unavailable for evaluation; failing closed to needs-review.",
    );
  }
  if (typeof input.text !== "string" || input.text.trim().length === 0) {
    return failClosed(
      "Empty or missing content cannot be proven safe; failing closed to needs-review.",
    );
  }

  let banned: string[];
  let needsProof: string[];
  try {
    banned = getBannedClaimMatches(input.initiative, input.text).map(
      (rule) => rule.text,
    );
    needsProof = getNeedsProofClaimMatches(input.initiative, input.text).map(
      (rule) => rule.text,
    );
  } catch {
    return failClosed(
      "Claim matcher evaluation failed; failing closed to needs-review.",
    );
  }

  if (banned.length > 0) {
    return {
      verdict: "blocked",
      policyVersion: CLAIM_POLICY_VERSION,
      bannedMatches: banned,
      needsProofMatches: needsProof,
      evidenceRefs,
      rationale: `Banned claim match(es) require removal before any apply: ${banned.join("; ")}. [${CLAIM_POLICY_VERSION}]`,
    };
  }
  if (needsProof.length > 0) {
    const evidenceNote =
      evidenceRefs.length > 0
        ? `${evidenceRefs.length} evidence ref(s) attached; recorded operator approval is still required before apply.`
        : "No evidence refs attached; evidence plus recorded operator approval is required before apply.";
    return {
      verdict: "needs-review",
      policyVersion: CLAIM_POLICY_VERSION,
      bannedMatches: banned,
      needsProofMatches: needsProof,
      evidenceRefs,
      rationale: `Needs-proof claim match(es) require evidence and approval: ${needsProof.join("; ")}. ${evidenceNote} [${CLAIM_POLICY_VERSION}]`,
    };
  }
  return {
    verdict: "safe",
    policyVersion: CLAIM_POLICY_VERSION,
    bannedMatches: banned,
    needsProofMatches: needsProof,
    evidenceRefs,
    rationale: `No banned or needs-proof rule matched under literal matching; approval and evidence checks still apply downstream. [${CLAIM_POLICY_VERSION}]`,
  };
}

/** Strict verdict for a single content evaluation (pure, fail-closed). */
export function evaluateClaim(input: ClaimPolicyInput): ClaimPolicyVerdict {
  return evaluateClaimDetailed(input).verdict;
}
