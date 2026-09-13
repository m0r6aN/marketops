import Ajv from "ajv";
import { describe, expect, test } from "vitest";

import type {
  DeliberationCandidate,
  KeonDecisionPair,
  KeonDisposition,
  KeonEnvelope,
  LedgerEntry,
  ScanReceipt,
} from "@/lib/keon/types";
import { LEDGER_GENESIS_PREV_HASH } from "@/lib/keon/types";
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

const baseRequest = (keonDecision as KeonDecisionPair).request;

function validateDisposition(data: unknown): boolean {
  // Validate through the root schema: the Disposition subschema refs a
  // sibling definition (#/definitions/PolicyHash) that only resolves there.
  return validate(keonDecisionSchema, { request: baseRequest, disposition: data });
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
  });

  test("deny without denial fields is rejected (mirrors GateResult)", () => {
    const denied = {
      ...(keonEnvelope as KeonEnvelope),
      ok: false,
      status: "denied",
      decision: {
        status: "deny",
        policy_hash: (keonEnvelope as KeonEnvelope).decision.policy_hash,
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
    const base = keonEnvelope as KeonEnvelope;
    expect(validate(keonEnvelopeSchema, { ...base, ok: true, status: "denied" })).toBe(false);
    expect(validate(keonEnvelopeSchema, { ...base, ok: false, status: "ok" })).toBe(false);
  });

  test("rejects non-URI receipts and non-boolean isError", () => {
    const base = keonEnvelope as KeonEnvelope;
    expect(validate(keonEnvelopeSchema, { ...base, receipts: ["bare-id-123"] })).toBe(false);
    expect(validate(keonEnvelopeSchema, { ...base, isError: "false" })).toBe(false);
  });
});

describe("KeonDecision contract", () => {
  test("require-review pair fixture satisfies the schema", () => {
    const pair = keonDecision as KeonDecisionPair;
    expect(validate(keonDecisionSchema, pair)).toBe(true);
    expect(pair.disposition?.decision).toBe("require-review");
  });

  test("deny disposition without denialCode/denialMessage is rejected", () => {
    const base = (keonDecision as KeonDecisionPair).disposition as KeonDisposition;
    expect(validateDisposition({ ...base, decision: "deny" })).toBe(false);
    expect(
      validateDisposition({
        ...base,
        decision: "deny",
        denialCode: "keon-offline",
        denialMessage: "Runtime unavailable; effect-bearing path halted.",
        failureStage: "exception",
      })
    ).toBe(true);
  });

  test("rejects unknown decision, unlisted effect, and missing idempotencyKey", () => {
    const pair = keonDecision as KeonDecisionPair;
    expect(
      validateDisposition({ ...pair.disposition, decision: "maybe" })
    ).toBe(false);
    expect(
      validate(keonDecisionSchema, {
        request: { ...pair.request, effect: "maybe-effecting" },
      })
    ).toBe(false);
    const withoutKey: Record<string, unknown> = { ...pair.request };
    delete withoutKey.idempotencyKey;
    expect(validate(keonDecisionSchema, { request: withoutKey })).toBe(false);
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

  test("genesis prevHash equals the documented constant", () => {
    const chain = ledgerChain as LedgerEntry[];
    expect(chain[0].seq).toBe(0);
    expect(chain[0].prevHash).toBe(LEDGER_GENESIS_PREV_HASH);
    expect(LEDGER_GENESIS_PREV_HASH).toBe("0".repeat(64));
  });

  test("chain prevHash linkage holds across entries", () => {
    const chain = ledgerChain as LedgerEntry[];
    const seqs = chain.map((e) => e.seq);
    expect(seqs).toEqual([0, 1, 2]);
    for (let i = 1; i < chain.length; i += 1) {
      expect(chain[i].prevHash).toBe(chain[i - 1].entryHash);
    }
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

describe("cross-contract tenant integrity", () => {
  test("every keon fixture tenantId exists in the tenant roster", () => {
    const roster = new Set((tenants as { tenantId: string }[]).map((t) => t.tenantId));
    expect(roster.has((keonDecision as KeonDecisionPair).request.tenantId)).toBe(true);
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
      (keonDecision as KeonDecisionPair).request.tenantId,
      (deliberationCandidate as DeliberationCandidate).tenantId,
      (scanReceipt as ScanReceipt).tenantId,
      ...(ledgerChain as LedgerEntry[]).map((e) => e.tenantId),
    ]);
    expect(seen.has("tenant-keon")).toBe(true);
    expect(seen.has("tenant-biostack")).toBe(true);
  });
});
