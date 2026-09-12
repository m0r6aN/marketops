import { isContactFingerprintSuppressed } from "@/lib/customer-finder/db";
import type { ComplianceCheck, ConsentBasis } from "@/lib/marketops/entities";

// Evaluation-only compliance gates for email campaigns. Send stays BLOCKED:
// this module defines no send function, no adapter, and performs no network
// calls. It only evaluates ComplianceCheck-shaped outcomes (verdict plus
// blockedReasons) mirroring contracts/ComplianceCheck.json and the
// ComplianceCheck entity in src/lib/marketops/entities.ts.

// Blocked-reason phrases. The consent / unsubscribe / sender-auth phrases
// reuse tests/contracts/fixtures/compliance-checks.json verbatim; the
// suppression / physical-address phrases follow the same terse style (no
// fixture covers those cases).
export const EMAIL_COMPLIANCE_BLOCKED_REASONS = {
  consent: "missing consent basis",
  suppression: "suppression list hit",
  unsubscribe: "missing unsubscribe link",
  senderAuth: "sender authentication failed (SPF/DKIM/DMARC)",
  physicalAddress: "missing physical address",
} as const;

export type EmailComplianceGateInput = {
  tenantId: string;
  campaignId?: string | null;
  consentBasis: ConsentBasis;
  suppressionHit: boolean;
  suppressionChecked: boolean;
  unsubscribeLinkPresent: boolean;
  senderAuthPass: boolean;
  physicalAddressPresent: boolean;
  checkedAtUtc?: string;
};

const consentBases: readonly ConsentBasis[] = ["opt-in", "legitimate-interest", "none"];

export function evaluateCompliance(input: EmailComplianceGateInput): ComplianceCheck {
  if (!input.tenantId.trim()) throw new Error("Compliance evaluation requires a tenantId.");
  if (!consentBases.includes(input.consentBasis)) throw new Error("Compliance evaluation requires a valid consentBasis.");
  const blockedReasons: string[] = [];
  if (input.consentBasis === "none") blockedReasons.push(EMAIL_COMPLIANCE_BLOCKED_REASONS.consent);
  if (input.suppressionHit) blockedReasons.push(EMAIL_COMPLIANCE_BLOCKED_REASONS.suppression);
  if (!input.unsubscribeLinkPresent) blockedReasons.push(EMAIL_COMPLIANCE_BLOCKED_REASONS.unsubscribe);
  if (!input.senderAuthPass) blockedReasons.push(EMAIL_COMPLIANCE_BLOCKED_REASONS.senderAuth);
  if (!input.physicalAddressPresent) blockedReasons.push(EMAIL_COMPLIANCE_BLOCKED_REASONS.physicalAddress);
  return {
    tenantId: input.tenantId,
    campaignId: input.campaignId ?? null,
    consentBasis: input.consentBasis,
    suppressionChecked: input.suppressionChecked,
    unsubscribeLinkPresent: input.unsubscribeLinkPresent,
    senderAuthPass: input.senderAuthPass,
    physicalAddressPresent: input.physicalAddressPresent,
    verdict: blockedReasons.length > 0 ? "blocked" : "pass",
    blockedReasons,
    checkedAtUtc: input.checkedAtUtc ?? new Date().toISOString(),
  };
}

export type EmailComplianceEvaluationInput = {
  tenantId: string;
  campaignId?: string | null;
  consentBasis: ConsentBasis;
  contactFingerprints?: readonly string[];
  suppressionHit?: boolean;
  suppressionChecked?: boolean;
  unsubscribeLinkPresent: boolean;
  senderAuthPass: boolean;
  physicalAddressPresent: boolean;
  checkedAtUtc?: string;
};

export type EmailComplianceEvaluation = {
  // Send stays BLOCKED: evaluation-only outcome, no adapter may execute.
  outcome: "blocked";
  // No send path executes on this path, before or after evaluation.
  sent: false;
  check: ComplianceCheck;
};

// Service-path entry point: resolves suppression hits against the
// customer-finder suppression list (read-only), evaluates the gates, and
// always reports a blocked (not-sent) outcome. Evaluation only.
export function evaluateEmailCampaignCompliance(
  input: EmailComplianceEvaluationInput,
  deps: { isSuppressed?: (contactFingerprint: string) => boolean } = {},
): EmailComplianceEvaluation {
  const isSuppressed = deps.isSuppressed ?? isContactFingerprintSuppressed;
  const fingerprints = input.contactFingerprints ?? [];
  const suppressionHit =
    input.suppressionHit === true || fingerprints.some((fingerprint) => isSuppressed(fingerprint));
  const check = evaluateCompliance({
    tenantId: input.tenantId,
    campaignId: input.campaignId,
    consentBasis: input.consentBasis,
    suppressionHit,
    suppressionChecked: input.suppressionChecked ?? fingerprints.length > 0,
    unsubscribeLinkPresent: input.unsubscribeLinkPresent,
    senderAuthPass: input.senderAuthPass,
    physicalAddressPresent: input.physicalAddressPresent,
    checkedAtUtc: input.checkedAtUtc,
  });
  return { outcome: "blocked", sent: false, check };
}
