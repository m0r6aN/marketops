import Ajv from "ajv";
import { describe, expect, test } from "vitest";

import type {
  DeliberationCandidate,
  KeonDecisionPair,
  KeonEnvelope,
  KeonEnvelopeDecision,
  KeonPolicyDecision,
  KeonReceiptRequest,
  LedgerEntry,
  ScanReceipt,
} from "@/lib/keon/types";
import {
  deriveKeonDispositionDecision,
  KEON_DISPOSITION_DERIVATION,
  KEON_MARKER_CLIENT_FAIL_CLOSED,
  KEON_MARKER_LOCAL_CLASSIFIER,
  KEON_MARKER_UNANCHORED,
  KEON_POLICY_DECISIONS,
  KEON_RECEIPT_CLASS_CATALOG,
  LEDGER_GENESIS_PREV_HASH,
} from "@/lib/keon/types";
import deliberationCandidateSchema from "../../contracts/DeliberationCandidate.json";
import keonDecisionSchema from "../../contracts/KeonDecision.json";
import keonEnvelopeSchema from "../../contracts/KeonEnvelope.json";
import ledgerEntrySchema from "../../contracts/LedgerEntry.json";
import scanReceiptSchema from "../../contracts/ScanReceipt.json";
import deliberationCandidate from "./fixtures/keon/deliberation-candidate.json";
import keonDecision from "./fixtures/keon/keon-decision.json";
import keonEnvelope from "./fixtures/keon/keon-envelope.json";
import ledgerChain from "./fixtures/keon/ledger-chain.json";
import scanReceipt from "./fixtures/keon/scan-receipt.json";
import tenants from "./fixtures/tenants.json";

// ajv is a transitive dependency (via eslint toolchain); used here for
// fixture-satisfies-contract tests only. No package.json change, no zod.
const ajv = new Ajv({ allErrors: true, strict: false });

function validate(schema: object, data: unknown): boolean {
  return ajv.validate(schema, data) as boolean;
}

const basePolicyCheck = (keonDecision as KeonDecisionPair).policyCheck;
const baseReceiptRequest = (keonDecision as KeonDecisionPair)
  .receiptRequest as KeonReceiptRequest;
const baseEnvelope = keonEnvelope as KeonEnvelope;

function validateReceiptRequest(data: unknown): boolean {
  // Validate through the root schema: the ReceiptRequest subschema refs a
  // sibling definition (#/definitions/PolicyHash) that only resolves there.
  return validate(keonDecisionSchema, {
    policyCheck: basePolicyCheck,
    receiptRequest: data,
  });
}

/** Minimal valid receipt request per native decision (with required payloads). */
function receiptFor(policyDecision: KeonPolicyDecision): KeonReceiptRequest {
  const base = {
    policyDecision,
    decision: deriveKeonDispositionDecision(policyDecision),
    policyHash: {
      value:
        "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      version: "claim-policy.v1",
    },
  };
  switch (policyDecision) {
    case "allowed-with-disclaimer":
      return {
        ...base,
        disclaimerText: "Framed as early evidence; not a guarantee.",
      };
    case "rewrite-required":
      return {
        ...base,
        rewrittenText: "Scoped rewrite replacing the proposed text.",
      };
    case "blocked":
      return {
        ...base,
        denialCode: "keon-offline",
        denialMessage: "Runtime unavailable; effect-bearing path halted.",
        failureStage: "exception" as const,
      };
    default:
      return base;
  }
}

/** Recursively collect every object key in a JSON value. */
function allKeys(value: unknown, into: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) allKeys(item, into);
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      into.add(key);
      allKeys(child, into);
    }
  }
}

describe("KeonEnvelope contract", () => {
  test("authorize fixture satisfies the schema", () => {
    expect(validate(keonEnvelopeSchema, keonEnvelope as KeonEnvelope)).toBe(true);
    expect(baseEnvelope.decision.policyDecision).toBe("allowed");
    expect(baseEnvelope.decision.status).toBe("authorize");
  });

  test("native policyDecision is required; invented tokens are rejected", () => {
    const withoutNative: Record<string, unknown> = {
      ...baseEnvelope.decision,
    };
    delete withoutNative.policyDecision;
    expect(
      validate(keonEnvelopeSchema, { ...baseEnvelope, decision: withoutNative })
    ).toBe(false);
    // The invented AllowedWithChecksumDisclaimer token is not a wire value.
    expect(
      validate(keonEnvelopeSchema, {
        ...baseEnvelope,
        decision: {
          ...baseEnvelope.decision,
          policyDecision: "AllowedWithChecksumDisclaimer",
        },
      })
    ).toBe(false);
    expect(
      validate(keonEnvelopeSchema, {
        ...baseEnvelope,
        decision: { ...baseEnvelope.decision, policyDecision: "maybe" },
      })
    ).toBe(false);
  });

  test("all five native decisions validate with their derived status", () => {
    const expected: Record<KeonPolicyDecision, KeonEnvelopeDecision["status"]> = {
      allowed: "authorize",
      "allowed-with-disclaimer": "authorize",
      "rewrite-required": "require-review",
      blocked: "deny",
      "escalate-to-provider-review": "require-review",
    };
    for (const policyDecision of KEON_POLICY_DECISIONS) {
      const decision = {
        ...baseEnvelope.decision,
        policyDecision,
        status: expected[policyDecision],
      };
      const candidate =
        policyDecision === "blocked"
          ? {
              ...baseEnvelope,
              ok: false,
              status: "denied",
              decision,
              denialCode: "policy-blocked",
              denialMessage: "Claim lacks sealed proof.",
              failureStage: "decision",
            }
          : { ...baseEnvelope, decision };
      expect(validate(keonEnvelopeSchema, candidate)).toBe(true);
    }
  });

  test("derived status must equal the native mapping (never substituted)", () => {
    expect(
      validate(keonEnvelopeSchema, {
        ...baseEnvelope,
        decision: { ...baseEnvelope.decision, status: "deny" },
      })
    ).toBe(false);
    expect(
      validate(keonEnvelopeSchema, {
        ...baseEnvelope,
        ok: false,
        status: "denied",
        decision: { ...baseEnvelope.decision, policyDecision: "blocked" },
        denialCode: "policy-blocked",
        denialMessage: "Claim lacks sealed proof.",
        failureStage: "decision",
      })
    ).toBe(false);
  });

  test("blocked without denial fields is rejected (mirrors GateResult)", () => {
    const denied = {
      ...baseEnvelope,
      ok: false,
      status: "denied",
      decision: {
        ...baseEnvelope.decision,
        policyDecision: "blocked",
        status: "deny",
      },
    };
    expect(validate(keonEnvelopeSchema, denied)).toBe(false);
    expect(
      validate(keonEnvelopeSchema, {
        ...denied,
        denialCode: "policy-blocked",
        denialMessage: "Claim lacks sealed proof.",
        failureStage: "decision",
      })
    ).toBe(true);
  });

  test("ok/status consistency is enforced both ways", () => {
    expect(validate(keonEnvelopeSchema, { ...baseEnvelope, ok: true, status: "denied" })).toBe(false);
    expect(validate(keonEnvelopeSchema, { ...baseEnvelope, ok: false, status: "ok" })).toBe(false);
  });

  test("rejects non-URI receipts and non-boolean isError", () => {
    expect(validate(keonEnvelopeSchema, { ...baseEnvelope, receipts: ["bare-id-123"] })).toBe(false);
    expect(validate(keonEnvelopeSchema, { ...baseEnvelope, isError: "false" })).toBe(false);
  });
});

describe("KeonDecision contract (PolicyCheck + ReceiptRequest)", () => {
  test("shapes use client vocabulary: policyCheck + receiptRequest only", () => {
    const root = keonDecisionSchema as {
      properties: Record<string, unknown>;
      definitions: Record<string, unknown>;
    };
    expect(Object.keys(root.properties).sort()).toEqual([
      "policyCheck",
      "receiptRequest",
    ]);
    expect(Object.keys(root.definitions).sort()).toEqual([
      "PolicyCheckRequest",
      "PolicyHash",
      "ReceiptRequest",
    ]);
  });

  test("rewrite-required pair fixture satisfies the schema", () => {
    const pair = keonDecision as KeonDecisionPair;
    expect(validate(keonDecisionSchema, pair)).toBe(true);
    expect(pair.receiptRequest?.policyDecision).toBe("rewrite-required");
    expect(pair.receiptRequest?.decision).toBe("require-review");
    expect(pair.receiptRequest?.rewrittenText).toBeTruthy();
  });

  test("all five native decisions validate with their required payloads", () => {
    for (const policyDecision of KEON_POLICY_DECISIONS) {
      expect(validateReceiptRequest(receiptFor(policyDecision))).toBe(true);
    }
  });

  test("coarse decision alone is rejected: native policyDecision is required", () => {
    const coarseOnly: Record<string, unknown> = { ...baseReceiptRequest };
    delete coarseOnly.policyDecision;
    expect(validateReceiptRequest(coarseOnly)).toBe(false);
    // The invented AllowedWithChecksumDisclaimer token is not a wire value.
    expect(
      validateReceiptRequest({
        ...baseReceiptRequest,
        policyDecision: "AllowedWithChecksumDisclaimer",
      })
    ).toBe(false);
    expect(
      validateReceiptRequest({ ...baseReceiptRequest, policyDecision: "maybe" })
    ).toBe(false);
  });

  test("disclaimer/rewritten/denial payloads are required by native value", () => {
    const disclaimer = receiptFor("allowed-with-disclaimer");
    const withoutDisclaimer: Record<string, unknown> = { ...disclaimer };
    delete withoutDisclaimer.disclaimerText;
    expect(validateReceiptRequest(withoutDisclaimer)).toBe(false);
    expect(validateReceiptRequest(disclaimer)).toBe(true);

    const rewritten = receiptFor("rewrite-required");
    const withoutRewritten: Record<string, unknown> = { ...rewritten };
    delete withoutRewritten.rewrittenText;
    expect(validateReceiptRequest(withoutRewritten)).toBe(false);

    const blocked = receiptFor("blocked");
    const withoutDenial: Record<string, unknown> = { ...blocked };
    delete withoutDenial.denialCode;
    delete withoutDenial.denialMessage;
    expect(validateReceiptRequest(withoutDenial)).toBe(false);
    expect(validateReceiptRequest(blocked)).toBe(true);
  });

  test("derived decision must equal the native mapping (never substituted)", () => {
    expect(
      validateReceiptRequest({ ...receiptFor("allowed"), decision: "deny" })
    ).toBe(false);
    expect(
      validateReceiptRequest({
        ...receiptFor("escalate-to-provider-review"),
        decision: "authorize",
      })
    ).toBe(false);
  });

  test("zeroed-hash markers are never conflated with anchored receipts", () => {
    const blocked = receiptFor("blocked");
    // Unanchored rows use a distinct local scheme, never keon://.
    expect(
      validateReceiptRequest({
        ...blocked,
        policyHash: { ...KEON_MARKER_UNANCHORED },
        decisionReceiptUri: "keon://receipt/anchored-123",
      })
    ).toBe(false);
    expect(
      validateReceiptRequest({
        ...blocked,
        policyHash: { ...KEON_MARKER_UNANCHORED },
        decisionReceiptUri: "marketops://unanchored-receipt/abc123",
      })
    ).toBe(true);
    // Local-classifier and client-fail-closed markers never anchor either.
    expect(
      validateReceiptRequest({
        ...blocked,
        policyHash: { ...KEON_MARKER_LOCAL_CLASSIFIER },
        decisionReceiptUri: "keon://receipt/anchored-123",
      })
    ).toBe(false);
    expect(
      validateReceiptRequest({
        ...blocked,
        policyHash: { ...KEON_MARKER_CLIENT_FAIL_CLOSED },
        decisionReceiptUri: "keon://receipt/anchored-123",
      })
    ).toBe(false);
    // Fail-closed checks carry no receipt at all.
    const failClosed: Record<string, unknown> = {
      ...blocked,
      policyHash: { ...KEON_MARKER_CLIENT_FAIL_CLOSED },
    };
    delete failClosed.decisionReceiptUri;
    expect(validateReceiptRequest(failClosed)).toBe(true);
  });

  test("rejects unknown effect and missing idempotencyKey", () => {
    const pair = keonDecision as KeonDecisionPair;
    expect(
      validate(keonDecisionSchema, {
        policyCheck: { ...pair.policyCheck, effect: "maybe-effecting" },
      })
    ).toBe(false);
    const withoutKey: Record<string, unknown> = { ...pair.policyCheck };
    delete withoutKey.idempotencyKey;
    expect(validate(keonDecisionSchema, { policyCheck: withoutKey })).toBe(false);
  });
});

describe("native decision derivation + zeroed-hash markers", () => {
  test("derivation helper maps all five native values", () => {
    expect(KEON_DISPOSITION_DERIVATION).toEqual({
      allowed: "authorize",
      "allowed-with-disclaimer": "authorize",
      "rewrite-required": "require-review",
      blocked: "deny",
      "escalate-to-provider-review": "require-review",
    });
    for (const native of KEON_POLICY_DECISIONS) {
      expect(deriveKeonDispositionDecision(native)).toBe(
        KEON_DISPOSITION_DERIVATION[native]
      );
    }
  });

  test("the three markers are distinct pairs sharing version 0.0.0", () => {
    const markers = [
      KEON_MARKER_UNANCHORED,
      KEON_MARKER_LOCAL_CLASSIFIER,
      KEON_MARKER_CLIENT_FAIL_CLOSED,
    ];
    expect(new Set(markers.map((m) => JSON.stringify(m))).size).toBe(3);
    expect(new Set(markers.map((m) => m.value)).size).toBe(3);
    for (const marker of markers) {
      expect(marker.version).toBe("0.0.0");
    }
    expect(KEON_MARKER_UNANCHORED.value).toBe("unanchored-local");
    expect(KEON_MARKER_LOCAL_CLASSIFIER.value).toBe("local-classifier-v0");
    expect(KEON_MARKER_CLIENT_FAIL_CLOSED.value).toBe("ERROR");
  });
});

describe("receipt-class catalog", () => {
  test("catalog reserves MarketOps families as reserved-not-wired", () => {
    expect(KEON_RECEIPT_CLASS_CATALOG.status).toBe("reserved-not-wired");
    expect([...KEON_RECEIPT_CLASS_CATALOG.families]).toEqual([
      "campaign.publish.*",
      "approval.*",
      "billing.*",
      "browseahead.scan.*",
      "ledger.entry.*",
    ]);
    expect(KEON_RECEIPT_CLASS_CATALOG.sentinel).toBe("legacy.unclassified");
  });

  test("fixtures issue catalog classes, never foreign ones", () => {
    const issued = [
      (keonDecision as KeonDecisionPair).receiptRequest
        ?.receiptClass as string,
      ...((ledgerChain as LedgerEntry[]).map((e) => e.receiptClass)),
    ];
    expect(issued.length).toBeGreaterThan(0);
    for (const receiptClass of issued) {
      expect(receiptClass).toBeTruthy();
      expect(receiptClass).not.toBe("deliberation.stack-review.completed");
      const families = KEON_RECEIPT_CLASS_CATALOG.families.map((f) =>
        f.replace(".*", "")
      );
      expect(
        families.some(
          (family) =>
            receiptClass === family || receiptClass.startsWith(`${family}.`)
        )
      ).toBe(true);
    }
  });
});

describe("DeliberationCandidate contract", () => {
  test("evidence fixture satisfies the schema", () => {
    expect(validate(deliberationCandidateSchema, deliberationCandidate as DeliberationCandidate)).toBe(
      true
    );
  });

  test("dissent is never empty-string-dropped", () => {
    const base = deliberationCandidate as DeliberationCandidate;
    expect(validate(deliberationCandidateSchema, { ...base, dissent: "" })).toBe(false);
    const withoutDissent: Record<string, unknown> = { ...base };
    delete withoutDissent.dissent;
    expect(validate(deliberationCandidateSchema, withoutDissent)).toBe(false);
  });

  test("deliberation-with-permission is rejected by shape review", () => {
    const base = deliberationCandidate as DeliberationCandidate;
    expect(
      validate(deliberationCandidateSchema, {
        ...base,
        grantsExecutionAuthority: true,
        executesAction: "campaign.publish",
      })
    ).toBe(false);
    // And no permission-shaped field exists anywhere in the valid fixture.
    const keys = new Set<string>();
    allKeys(deliberationCandidate, keys);
    for (const forbidden of [
      "grantsExecutionAuthority",
      "executesAction",
      "permission",
      "authorizedEffect",
      "allowExecution",
      "execute",
    ]) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });

  test("rejects out-of-range confidence and bad lineage", () => {
    const base = deliberationCandidate as DeliberationCandidate;
    expect(
      validate(deliberationCandidateSchema, {
        ...base,
        confidence: { value: 1.4, calibrationVersion: "calib.v3" },
      })
    ).toBe(false);
    expect(
      validate(deliberationCandidateSchema, {
        ...base,
        lineage: { ...base.lineage, reviewId: "" },
      })
    ).toBe(false);
  });
});

describe("ScanReceipt contract", () => {
  test("fail_closed fixture satisfies the schema with null signature", () => {
    const scan = scanReceipt as ScanReceipt;
    expect(validate(scanReceiptSchema, scan)).toBe(true);
    expect(scan.ingestionHint).toBe("fail_closed");
    expect(scan.signature).toBeNull();
  });

  test("fetched-provenance on caller bytes is rejected", () => {
    const base = scanReceipt as ScanReceipt;
    // No sourceUri: cannot claim fetched provenance over caller-supplied bytes.
    expect(
      validate(scanReceiptSchema, {
        ...base,
        scan: { ...base.scan, provenance: "fetched" },
      })
    ).toBe(false);
    expect(
      validate(scanReceiptSchema, {
        ...base,
        scan: { ...base.scan, provenance: "fetched", sourceUri: "https://example.com/source" },
      })
    ).toBe(true);
  });

  test("rejects non-raw mode and fail_closed with low severity", () => {
    const base = scanReceipt as ScanReceipt;
    expect(
      validate(scanReceiptSchema, { ...base, scan: { ...base.scan, mode: "live-render" } })
    ).toBe(false);
    expect(
      validate(scanReceiptSchema, { ...base, severity: "low", ingestionHint: "fail_closed" })
    ).toBe(false);
  });
});

describe("LedgerEntry contract", () => {
  test("3-entry chain fixtures satisfy the schema", () => {
    const chain = ledgerChain as LedgerEntry[];
    expect(chain).toHaveLength(3);
    for (const entry of chain) {
      expect(validate(ledgerEntrySchema, entry)).toBe(true);
    }
  });

  test("genesis prevHash equals the BioStack genesis constant", () => {
    const chain = ledgerChain as LedgerEntry[];
    expect(chain[0].seq).toBe(0);
    expect(chain[0].prevHash).toBe(LEDGER_GENESIS_PREV_HASH);
    expect(LEDGER_GENESIS_PREV_HASH).toBe("sha256:genesis");
  });

  test("chain prevHash linkage holds across entries", () => {
    const chain = ledgerChain as LedgerEntry[];
    const seqs = chain.map((e) => e.seq);
    expect(seqs).toEqual([0, 1, 2]);
    for (let i = 1; i < chain.length; i += 1) {
      expect(chain[i].prevHash).toBe(chain[i - 1].entryHash);
    }
  });

  test("hashes use sha256:<hex> encoding; bare hex is rejected", () => {
    const base = (ledgerChain as LedgerEntry[])[1];
    expect(
      validate(ledgerEntrySchema, {
        ...base,
        entryHash:
          "2222222222222222222222222222222222222222222222222222222222222222",
      })
    ).toBe(false);
    expect(
      validate(ledgerEntrySchema, {
        ...base,
        prevHash:
          "1111111111111111111111111111111111111111111111111111111111111111",
      })
    ).toBe(false);
  });

  test("receiptClass, actorId, and timestamp are required", () => {
    const base = (ledgerChain as LedgerEntry[])[0];
    for (const field of ["receiptClass", "actorId", "timestamp"] as const) {
      const without: Record<string, unknown> = { ...base };
      delete without[field];
      expect(validate(ledgerEntrySchema, without)).toBe(false);
    }
  });

  test("legacy.unclassified is accepted; two-segment classes are rejected", () => {
    const base = (ledgerChain as LedgerEntry[])[0];
    expect(
      validate(ledgerEntrySchema, {
        ...base,
        receiptClass: "legacy.unclassified",
      })
    ).toBe(true);
    expect(
      validate(ledgerEntrySchema, { ...base, receiptClass: "legacy.unclass" })
    ).toBe(false);
    expect(
      validate(ledgerEntrySchema, { ...base, receiptClass: "Campaign.Publish" })
    ).toBe(false);
  });

  test("missing receiptRef and bare-id refs are rejected", () => {
    const base = (ledgerChain as LedgerEntry[])[0];
    const withoutRef: Record<string, unknown> = { ...base };
    delete withoutRef.receiptRef;
    expect(validate(ledgerEntrySchema, withoutRef)).toBe(false);
    expect(validate(ledgerEntrySchema, { ...base, receiptRef: "bare-id-123" })).toBe(false);
  });

  test("epochRef accepts null (pre-S11) and a future epoch string", () => {
    const base = (ledgerChain as LedgerEntry[])[0];
    expect(validate(ledgerEntrySchema, base)).toBe(true);
    expect(
      validate(ledgerEntrySchema, { ...base, epochRef: "epoch:2026-w37" })
    ).toBe(true);
  });
});

describe("contract casing (one casing per schema, no mixing)", () => {
  test("no snake_case keys in any contract schema or keon fixture", () => {
    const keys = new Set<string>();
    for (const doc of [
      keonEnvelopeSchema,
      keonDecisionSchema,
      deliberationCandidateSchema,
      scanReceiptSchema,
      ledgerEntrySchema,
      keonEnvelope,
      keonDecision,
      deliberationCandidate,
      scanReceipt,
      ledgerChain,
    ]) {
      allKeys(doc, keys);
    }
    expect([...keys].filter((key) => key.includes("_"))).toEqual([]);
  });
});

describe("cross-contract tenant integrity", () => {
  test("every keon fixture tenantId exists in the tenant roster", () => {
    const roster = new Set((tenants as { tenantId: string }[]).map((t) => t.tenantId));
    expect(roster.has((keonDecision as KeonDecisionPair).policyCheck.tenantId)).toBe(true);
    expect(roster.has((deliberationCandidate as DeliberationCandidate).tenantId)).toBe(true);
    expect(roster.has((scanReceipt as ScanReceipt).tenantId)).toBe(true);
    for (const entry of ledgerChain as LedgerEntry[]) {
      expect(roster.has(entry.tenantId)).toBe(true);
    }
    const envelopeResult = (keonEnvelope as KeonEnvelope).result as
      | { tenantId?: string }
      | undefined;
    if (envelopeResult?.tenantId != null) {
      expect(roster.has(envelopeResult.tenantId)).toBe(true);
    }
  });

  test("fixtures cover both roster tenants (keon + biostack)", () => {
    const seen = new Set<string>([
      (keonDecision as KeonDecisionPair).policyCheck.tenantId,
      (deliberationCandidate as DeliberationCandidate).tenantId,
      (scanReceipt as ScanReceipt).tenantId,
      ...(ledgerChain as LedgerEntry[]).map((e) => e.tenantId),
    ]);
    expect(seen.has("tenant-keon")).toBe(true);
    expect(seen.has("tenant-biostack")).toBe(true);
  });
});
