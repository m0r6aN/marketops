// ---------------------------------------------------------------------------
// k2-deliberation-evidence — S10 deliberation intake as claim-review EVIDENCE.
//
// Doctrine (binding, from locked Collective canon — do not relitigate):
// deliberation produces CANDIDATES, never execution authority; adversarial
// review required before effect-candidate preparation; receipts outrank
// narratives; confidence is information, never authority; tenant-scoped;
// handoff approval ≠ effect approval.
//
// This module is intake-only: it validates a DeliberationCandidate payload
// (contracts/DeliberationCandidate.json, mirrored in keon/types.ts),
// rejects ANY permission/authority/approval-effect shaped field fail-closed,
// enforces tenant scope, exposes the adversarial-review gate, and projects
// ONLY evidence-safe fields into the claim path. It issues no approvals,
// carries no execution permission, and never substitutes for the human
// approval checked at the apply gate (decideClaimApply hasApproval).
//
// Contract source of truth: contracts/DeliberationCandidate.json.
// No clients, no transport, no network calls. No new dependencies.
// ---------------------------------------------------------------------------

import type { DeliberationCandidate } from "@/lib/keon/types";
import type { ClaimPolicyVerdict } from "@/lib/persuasion-review/types";

/** Fail-closed intake refusal for deliberation candidates. */
export class DeliberationError extends Error {
  readonly code:
    | "DELIBERATION_INVALID"
    | "DELIBERATION_AUTHORITY_FORBIDDEN"
    | "DELIBERATION_TENANT_MISMATCH";

  constructor(
    code: DeliberationError["code"],
    message: string,
  ) {
    super(message);
    this.name = "DeliberationError";
    this.code = code;
  }
}

// -- Fail-closed allowlists (mirror contracts/DeliberationCandidate.json) ------

const TOP_LEVEL_FIELDS = new Set([
  "candidate",
  "challenges",
  "dissent",
  "confidence",
  "heatRef",
  "lineage",
  "tenantId",
]);

const CANDIDATE_FIELDS = new Set(["branch", "collapseRef", "rationale"]);

const CHALLENGE_FIELDS = new Set(["challenge", "raisedBy", "severity"]);

const CONFIDENCE_FIELDS = new Set(["value", "calibrationVersion"]);

const LINEAGE_FIELDS = new Set(["intentId", "collapseId", "reviewId"]);

/**
 * Authority-shaped key pattern (fail-closed). Matches permission, approval,
 * authorization, execution, effect, grant, and adjacent authority vocabulary.
 * None of the contract allowlists contain these substrings, so any match is
 * a refusal — including unknown future authority-shaped keys.
 */
const AUTHORITY_KEY_PATTERN =
  /approv|authori|permi|execut|effect|allow|grant|consent|clearance|privileg|entitl|decid|verdict|certif|attest|endorse|confirm/i;

const CHALLENGE_SEVERITIES = new Set(["low", "medium", "high"]);

/** Literal dissent marker when no dissent was voiced (never an empty string). */
export const DELIBERATION_NO_DISSENT_MARKER = "none-voiced";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Recursively collect every object key in a JSON value (arrays included). */
function collectKeys(value: unknown, into: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, into);
    return;
  }
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      into.push(key);
      collectKeys(child, into);
    }
  }
}

function rejectAuthorityKeys(payload: unknown): void {
  const keys: string[] = [];
  collectKeys(payload, keys);
  for (const key of keys) {
    if (AUTHORITY_KEY_PATTERN.test(key)) {
      throw new DeliberationError(
        "DELIBERATION_AUTHORITY_FORBIDDEN",
        `Deliberation candidate carries authority-shaped field "${key}"; candidates carry no permission and are rejected fail-closed.`,
      );
    }
  }
}

function rejectUnknownFields(
  record: Record<string, unknown>,
  allowlist: Set<string>,
  where: string,
): void {
  for (const key of Object.keys(record)) {
    if (!allowlist.has(key)) {
      throw new DeliberationError(
        "DELIBERATION_INVALID",
        `Deliberation candidate has unknown field "${key}" at ${where}; failing closed (allowlist only).`,
      );
    }
  }
}

/**
 * Accept a DeliberationCandidate payload for use as claim-review EVIDENCE.
 *
 * Validates required branch/dissent/confidence/lineage/tenantId shape per the
 * contract, rejects ANY permission/authority/approval-effect shaped field
 * fail-closed (including unknown authority-shaped keys), and enforces tenant
 * scope against the caller's expected tenant. Returns a sanitized copy
 * containing ONLY contract fields so downstream holders cannot smuggle
 * authority properties through.
 *
 * Confidence (even 1.0) is accepted as advisory information only — it never
 * confers approval and this function never reports an approval.
 */
export function acceptCandidate(
  payload: unknown,
  opts: { expectedTenantId: string },
): DeliberationCandidate {
  if (!isRecord(payload)) {
    throw new DeliberationError(
      "DELIBERATION_INVALID",
      "Deliberation candidate must be an object; failing closed.",
    );
  }
  if (!isNonEmptyString(opts?.expectedTenantId)) {
    throw new DeliberationError(
      "DELIBERATION_INVALID",
      "Deliberation intake requires an expected tenant; failing closed.",
    );
  }

  // Authority scan first: any authority-shaped key anywhere refuses before
  // any other interpretation (fail-closed, doctrine: never execution authority).
  rejectAuthorityKeys(payload);
  rejectUnknownFields(payload, TOP_LEVEL_FIELDS, "root");

  const { candidate, challenges, dissent, confidence, heatRef, lineage, tenantId } =
    payload as Record<string, unknown>;

  if (!isRecord(candidate)) {
    throw new DeliberationError(
      "DELIBERATION_INVALID",
      "Deliberation candidate.candidate must be an object; failing closed.",
    );
  }
  rejectUnknownFields(candidate, CANDIDATE_FIELDS, "candidate");
  if (!isNonEmptyString(candidate.branch)) {
    throw new DeliberationError(
      "DELIBERATION_INVALID",
      "Deliberation candidate requires a non-empty branch; failing closed.",
    );
  }
  if (!isNonEmptyString(candidate.collapseRef)) {
    throw new DeliberationError(
      "DELIBERATION_INVALID",
      "Deliberation candidate requires a non-empty collapseRef; failing closed.",
    );
  }
  if (!isNonEmptyString(candidate.rationale)) {
    throw new DeliberationError(
      "DELIBERATION_INVALID",
      "Deliberation candidate requires a non-empty rationale; failing closed.",
    );
  }

  if (!Array.isArray(challenges)) {
    throw new DeliberationError(
      "DELIBERATION_INVALID",
      "Deliberation candidate requires a challenges array (present even when empty); failing closed.",
    );
  }
  for (let index = 0; index < challenges.length; index += 1) {
    const entry = challenges[index];
    if (!isRecord(entry)) {
      throw new DeliberationError(
        "DELIBERATION_INVALID",
        `Deliberation challenge ${index} must be an object; failing closed.`,
      );
    }
    rejectUnknownFields(entry, CHALLENGE_FIELDS, `challenges[${index}]`);
    if (!isNonEmptyString(entry.challenge)) {
      throw new DeliberationError(
        "DELIBERATION_INVALID",
        `Deliberation challenge ${index} requires non-empty challenge text; failing closed.`,
      );
    }
    if (entry.raisedBy !== undefined && !isNonEmptyString(entry.raisedBy)) {
      throw new DeliberationError(
        "DELIBERATION_INVALID",
        `Deliberation challenge ${index} raisedBy must be a non-empty string when present; failing closed.`,
      );
    }
    if (
      entry.severity !== undefined &&
      (typeof entry.severity !== "string" || !CHALLENGE_SEVERITIES.has(entry.severity))
    ) {
      throw new DeliberationError(
        "DELIBERATION_INVALID",
        `Deliberation challenge ${index} severity must be low, medium, or high; failing closed.`,
      );
    }
  }

  // Dissent is preserved verbatim and never empty-string-dropped; the
  // literal 'none-voiced' marker records the no-dissent case.
  if (!isNonEmptyString(dissent)) {
    throw new DeliberationError(
      "DELIBERATION_INVALID",
      "Deliberation candidate requires non-empty dissent (use 'none-voiced' when none was voiced); failing closed.",
    );
  }

  if (!isRecord(confidence)) {
    throw new DeliberationError(
      "DELIBERATION_INVALID",
      "Deliberation candidate requires a confidence object; failing closed.",
    );
  }
  rejectUnknownFields(confidence, CONFIDENCE_FIELDS, "confidence");
  if (
    typeof confidence.value !== "number" ||
    !Number.isFinite(confidence.value) ||
    confidence.value < 0 ||
    confidence.value > 1
  ) {
    throw new DeliberationError(
      "DELIBERATION_INVALID",
      "Deliberation confidence.value must be a finite number in [0,1]; failing closed.",
    );
  }
  if (!isNonEmptyString(confidence.calibrationVersion)) {
    throw new DeliberationError(
      "DELIBERATION_INVALID",
      "Deliberation candidate requires a non-empty confidence.calibrationVersion; failing closed.",
    );
  }

  if (heatRef !== undefined && !isNonEmptyString(heatRef)) {
    throw new DeliberationError(
      "DELIBERATION_INVALID",
      "Deliberation heatRef must be a non-empty string when present; failing closed.",
    );
  }

  if (!isRecord(lineage)) {
    throw new DeliberationError(
      "DELIBERATION_INVALID",
      "Deliberation candidate requires a lineage object; failing closed.",
    );
  }
  rejectUnknownFields(lineage, LINEAGE_FIELDS, "lineage");
  for (const field of ["intentId", "collapseId", "reviewId"] as const) {
    if (!isNonEmptyString(lineage[field])) {
      throw new DeliberationError(
        "DELIBERATION_INVALID",
        `Deliberation lineage requires non-empty ${field}; failing closed.`,
      );
    }
  }

  if (!isNonEmptyString(tenantId)) {
    throw new DeliberationError(
      "DELIBERATION_INVALID",
      "Deliberation candidate requires a non-empty tenantId; failing closed.",
    );
  }
  if (tenantId !== opts.expectedTenantId) {
    throw new DeliberationError(
      "DELIBERATION_TENANT_MISMATCH",
      `Deliberation candidate tenant "${tenantId}" does not match the review tenant; refusing cross-tenant evidence.`,
    );
  }

  // Sanitized copy: ONLY contract fields survive, so authority properties
  // cannot flow downstream even by reference.
  const accepted: DeliberationCandidate = {
    candidate: {
      branch: candidate.branch as string,
      collapseRef: candidate.collapseRef as string,
      rationale: candidate.rationale as string,
    },
    challenges: (challenges as Array<Record<string, unknown>>).map((entry) => {
      const out: DeliberationCandidate["challenges"][number] = {
        challenge: entry.challenge as string,
      };
      if (isNonEmptyString(entry.raisedBy)) out.raisedBy = entry.raisedBy;
      if (
        typeof entry.severity === "string" &&
        CHALLENGE_SEVERITIES.has(entry.severity)
      ) {
        out.severity = entry.severity as "low" | "medium" | "high";
      }
      return out;
    }),
    dissent: dissent as string,
    confidence: {
      value: confidence.value as number,
      calibrationVersion: confidence.calibrationVersion as string,
    },
    lineage: {
      intentId: lineage.intentId as string,
      collapseId: lineage.collapseId as string,
      reviewId: lineage.reviewId as string,
    },
    tenantId: tenantId as string,
  };
  if (isNonEmptyString(heatRef)) accepted.heatRef = heatRef;
  return accepted;
}

/**
 * True when the candidate demonstrates adversarial review: at least one
 * preserved challenge bound to its lineage review. An empty challenges array
 * means no review state was demonstrated, even when the payload is otherwise
 * valid.
 */
export function hasAdversarialReview(candidate: DeliberationCandidate): boolean {
  if (!candidate || !Array.isArray(candidate.challenges)) return false;
  if (candidate.challenges.length === 0) return false;
  const reviewId = candidate.lineage?.reviewId;
  return typeof reviewId === "string" && reviewId.trim().length > 0;
}

/**
 * Adversarial-review-required gate: a candidate WITHOUT review state cannot
 * advance past needs-review. A "safe" verdict caps to "needs-review" when no
 * review is demonstrated; blocked and needs-review verdicts pass through
 * unchanged. Deliberation NEVER upgrades a verdict toward safe and NEVER
 * reports an approval — it only caps, as uncertainty material.
 */
export function capClaimVerdictForDeliberation(
  verdict: ClaimPolicyVerdict,
  candidate: DeliberationCandidate,
): ClaimPolicyVerdict {
  if (verdict === "safe" && !hasAdversarialReview(candidate)) {
    return "needs-review";
  }
  return verdict;
}

/**
 * Project ONLY evidence-safe fields into the claim path: branch rationale,
 * challenge summaries, dissent text (verbatim), and confidence plus its
 * calibration version. Lineage, tenant, heat, collapse refs, and every other
 * field are dropped structurally — and any authority-shaped property on the
 * input is ignored here (acceptCandidate already rejects such payloads).
 *
 * The returned strings are uncertainty material for decideClaimApply
 * evidenceRefs and decision-receipt refs. They are NEVER an approval: a
 * confidence of 1.0 still requires recorded human approval at the gate.
 */
export function toClaimEvidence(candidate: DeliberationCandidate): string[] {
  if (!candidate || !isRecord(candidate as unknown as Record<string, unknown>)) {
    throw new DeliberationError(
      "DELIBERATION_INVALID",
      "Deliberation evidence requires an accepted candidate; failing closed.",
    );
  }
  const branch =
    typeof candidate.candidate?.branch === "string" &&
    candidate.candidate.branch.trim().length > 0
      ? candidate.candidate.branch
      : null;
  const rationale =
    typeof candidate.candidate?.rationale === "string" &&
    candidate.candidate.rationale.trim().length > 0
      ? candidate.candidate.rationale
      : null;
  const dissent =
    typeof candidate.dissent === "string" && candidate.dissent.length > 0
      ? candidate.dissent
      : null;
  const confidenceValue = candidate.confidence?.value;
  const calibrationVersion = candidate.confidence?.calibrationVersion;
  if (!branch || !rationale || !dissent) {
    throw new DeliberationError(
      "DELIBERATION_INVALID",
      "Deliberation evidence requires branch, rationale, and dissent; failing closed.",
    );
  }
  if (
    typeof confidenceValue !== "number" ||
    !Number.isFinite(confidenceValue) ||
    confidenceValue < 0 ||
    confidenceValue > 1 ||
    typeof calibrationVersion !== "string" ||
    calibrationVersion.trim().length === 0
  ) {
    throw new DeliberationError(
      "DELIBERATION_INVALID",
      "Deliberation evidence requires confidence value in [0,1] plus calibration version; failing closed.",
    );
  }

  const refs: string[] = [];
  refs.push(`deliberation ${branch} rationale — ${rationale}`);
  for (const entry of candidate.challenges ?? []) {
    const text =
      typeof entry?.challenge === "string" ? entry.challenge : "";
    if (!text.trim()) continue;
    const qualifiers: string[] = [];
    if (entry.severity) qualifiers.push(entry.severity);
    if (entry.raisedBy) qualifiers.push(`raised by ${entry.raisedBy}`);
    const qualifier = qualifiers.length > 0 ? ` [${qualifiers.join("; ")}]` : "";
    refs.push(`deliberation ${branch} challenge${qualifier} — ${text}`);
  }
  // Dissent preserved verbatim: the exact input string is embedded unchanged.
  refs.push(`deliberation ${branch} dissent — ${dissent}`);
  refs.push(
    `deliberation ${branch} confidence — ${confidenceValue} (${calibrationVersion}; advisory only, never approval)`,
  );
  return refs;
}
