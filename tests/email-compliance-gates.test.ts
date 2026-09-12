import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, test } from "vitest";

import { db as customerFinderDb, isContactFingerprintSuppressed } from "@/lib/customer-finder/db";
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
import type { ComplianceCheck } from "@/lib/marketops/entities";
import complianceChecksFixture from "./contracts/fixtures/compliance-checks.json";

const CHECKED_AT = "2026-09-10T11:00:00Z";

function gateInput(overrides: Partial<EmailComplianceGateInput> = {}): EmailComplianceGateInput {
  return {
    tenantId: "tenant-keon",
    campaignId: "camp-keon-001",
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
    campaignId: "camp-keon-001",
    consentBasis: "opt-in",
    unsubscribeLinkPresent: true,
    senderAuthPass: true,
    physicalAddressPresent: true,
    checkedAtUtc: CHECKED_AT,
    ...overrides,
  };
}

function fixtureReasonsWhere(match: Partial<ComplianceCheck>): string[] {
  const found = (complianceChecksFixture as ComplianceCheck[]).find((check) =>
    Object.entries(match).every(([key, value]) => check[key as keyof ComplianceCheck] === value),
  );
  if (!found?.blockedReasons) throw new Error("Compliance fixture missing expected case.");
  return found.blockedReasons;
}

afterEach(() => {
  customerFinderDb
    .prepare(`DELETE FROM customer_finder_suppressions WHERE contact_fingerprint LIKE 'test-%'`)
    .run();
});

describe("email compliance gates", () => {
  test("blocked-reason phrases match the compliance-checks fixture language", () => {
    expect(fixtureReasonsWhere({ consentBasis: "none" })).toContain(
      EMAIL_COMPLIANCE_BLOCKED_REASONS.consent,
    );
    expect(fixtureReasonsWhere({ unsubscribeLinkPresent: false })).toContain(
      EMAIL_COMPLIANCE_BLOCKED_REASONS.unsubscribe,
    );
    expect(fixtureReasonsWhere({ senderAuthPass: false })).toContain(
      EMAIL_COMPLIANCE_BLOCKED_REASONS.senderAuth,
    );
  });

  test("consentBasis none blocks with the consent reason", () => {
    const check = evaluateCompliance(gateInput({ consentBasis: "none" }));
    expect(check.verdict).toBe("blocked");
    expect(check.blockedReasons).toEqual(["missing consent basis"]);
  });

  test("suppression hit blocks with the suppression reason", () => {
    const check = evaluateCompliance(gateInput({ suppressionHit: true }));
    expect(check.verdict).toBe("blocked");
    expect(check.blockedReasons).toContain("suppression list hit");
  });

  test("missing unsubscribe link blocks with the unsubscribe reason", () => {
    const check = evaluateCompliance(gateInput({ unsubscribeLinkPresent: false }));
    expect(check.verdict).toBe("blocked");
    expect(check.blockedReasons).toEqual(["missing unsubscribe link"]);
  });

  test("failed sender authentication blocks with the sender-auth reason", () => {
    const check = evaluateCompliance(gateInput({ senderAuthPass: false }));
    expect(check.verdict).toBe("blocked");
    expect(check.blockedReasons).toEqual(["sender authentication failed (SPF/DKIM/DMARC)"]);
  });

  test("missing physical address blocks with the physical-address reason", () => {
    const check = evaluateCompliance(gateInput({ physicalAddressPresent: false }));
    expect(check.verdict).toBe("blocked");
    expect(check.blockedReasons).toEqual(["missing physical address"]);
  });

  test("multiple failures accumulate every applicable reason", () => {
    const check = evaluateCompliance(
      gateInput({
        consentBasis: "none",
        suppressionHit: true,
        unsubscribeLinkPresent: false,
        senderAuthPass: false,
        physicalAddressPresent: false,
      }),
    );
    expect(check.verdict).toBe("blocked");
    expect(check.blockedReasons).toEqual([
      "missing consent basis",
      "suppression list hit",
      "missing unsubscribe link",
      "sender authentication failed (SPF/DKIM/DMARC)",
      "missing physical address",
    ]);
  });

  test("all-pass input passes with empty blockedReasons and echoes the check fields", () => {
    const check = evaluateCompliance(gateInput());
    expect(check.verdict).toBe("pass");
    expect(check.blockedReasons).toEqual([]);
    expect(check).toMatchObject({
      tenantId: "tenant-keon",
      campaignId: "camp-keon-001",
      consentBasis: "opt-in",
      suppressionChecked: true,
      unsubscribeLinkPresent: true,
      senderAuthPass: true,
      physicalAddressPresent: true,
      checkedAtUtc: CHECKED_AT,
    });
  });

  test("suppression list read reports fingerprints present in customer_finder_suppressions", () => {
    const fingerprint = `test-${randomUUID()}`;
    expect(isContactFingerprintSuppressed(fingerprint)).toBe(false);
    customerFinderDb
      .prepare(
        `INSERT INTO customer_finder_suppressions(id, contact_fingerprint, channel, reason, created_at) VALUES(?, ?, ?, ?, ?)`,
      )
      .run(randomUUID(), fingerprint, "email", "unsubscribed", CHECKED_AT);
    expect(isContactFingerprintSuppressed(fingerprint)).toBe(true);
    expect(isContactFingerprintSuppressed(`test-${randomUUID()}`)).toBe(false);
  });

  test("service path resolves a suppression-list hit into a blocked check", () => {
    const fingerprint = `test-${randomUUID()}`;
    customerFinderDb
      .prepare(
        `INSERT INTO customer_finder_suppressions(id, contact_fingerprint, channel, reason, created_at) VALUES(?, ?, ?, ?, ?)`,
      )
      .run(randomUUID(), fingerprint, "email", "unsubscribed", CHECKED_AT);
    const evaluation = evaluateEmailCampaignCompliance(
      evaluationInput({ contactFingerprints: [fingerprint] }),
    );
    expect(evaluation.check.verdict).toBe("blocked");
    expect(evaluation.check.blockedReasons).toContain("suppression list hit");
    expect(evaluation.check.suppressionChecked).toBe(true);
  });

  test("no send path executes: evaluation stays blocked and not-sent even on pass", () => {
    const evaluation = evaluateEmailCampaignCompliance(evaluationInput());
    expect(evaluation.check.verdict).toBe("pass");
    expect(evaluation.outcome).toBe("blocked");
    expect(evaluation.sent).toBe(false);
  });

  test("no send function exists on the email-campaigns service or compliance path", () => {
    for (const entry of [emailCampaignsService, emailCampaignsCompliance]) {
      const suspicious = Object.keys(entry).filter((name) => /send|adapter|deliver/i.test(name));
      expect(suspicious).toEqual([]);
    }
  });
});
