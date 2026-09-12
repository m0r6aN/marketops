import Ajv from "ajv";
import { describe, expect, test } from "vitest";

import type {
  BetaTenant,
  ClaimEval,
  ComplianceCheck,
  Entitlement,
  ProofpackManifest,
} from "@/lib/marketops/entities";
import betaTenantSchema from "../../contracts/BetaTenant.json";
import claimEvalSchema from "../../contracts/ClaimEval.json";
import complianceCheckSchema from "../../contracts/ComplianceCheck.json";
import entitlementSchema from "../../contracts/Entitlement.json";
import proofpackManifestSchema from "../../contracts/ProofpackManifest.json";
import claimEvals from "./fixtures/claim-evals.json";
import complianceChecks from "./fixtures/compliance-checks.json";
import entitlements from "./fixtures/entitlements.json";
import proofpackManifest from "./fixtures/proofpack-manifest.json";
import tenants from "./fixtures/tenants.json";

// ajv is a transitive dependency (via eslint toolchain); used here for
// fixture-satisfies-contract tests only. No package.json change, no zod.
const ajv = new Ajv({ allErrors: true });

function validate(schema: object, data: unknown): boolean {
  return ajv.validate(schema, data) as boolean;
}

describe("BetaTenant contract", () => {
  test("both roster tenants satisfy the schema", () => {
    expect(tenants).toHaveLength(2);
    for (const tenant of tenants as BetaTenant[]) {
      expect(validate(betaTenantSchema, tenant)).toBe(true);
    }
  });

  test("roster has distinct tenants with private-by-default posture", () => {
    const ids = new Set((tenants as BetaTenant[]).map((t) => t.tenantId));
    expect(ids.size).toBe(2);
    const byId = Object.fromEntries((tenants as BetaTenant[]).map((t) => [t.tenantId, t]));
    expect(byId["tenant-keon"].public_safe).toBe(true);
    expect(byId["tenant-biostack"].public_safe).toBe(false);
  });

  test("rejects missing public_safe and unknown betaStatus", () => {
    const base = (tenants as BetaTenant[])[0];
    const withoutFlag: Record<string, unknown> = { ...base };
    delete withoutFlag.public_safe;
    expect(validate(betaTenantSchema, withoutFlag)).toBe(false);
    expect(validate(betaTenantSchema, { ...base, betaStatus: "everyone" })).toBe(false);
  });
});

describe("Entitlement contract", () => {
  test("fixtures satisfy the schema", () => {
    for (const entitlement of entitlements as Entitlement[]) {
      expect(validate(entitlementSchema, entitlement)).toBe(true);
    }
  });

  test("keon pilot is active, biostack pilot is lapsed (gate denies)", () => {
    const byId = Object.fromEntries((entitlements as Entitlement[]).map((e) => [e.tenantId, e]));
    expect(byId["tenant-keon"].status).toBe("active");
    expect(byId["tenant-keon"].features).toContain("proofpack-export");
    // Lapsed is schema-valid; enforcement (deny) lands in w2-billing-wire.
    expect(byId["tenant-biostack"].status).toBe("lapsed");
  });

  test("rejects unknown plan and status", () => {
    const base = (entitlements as Entitlement[])[0];
    expect(validate(entitlementSchema, { ...base, plan: "enterprise" })).toBe(false);
    expect(validate(entitlementSchema, { ...base, status: "trialing" })).toBe(false);
  });
});

describe("ClaimEval contract", () => {
  test("fixtures satisfy the schema", () => {
    for (const eval_ of claimEvals as ClaimEval[]) {
      expect(validate(claimEvalSchema, eval_)).toBe(true);
    }
  });

  test("safe claim stays safe across paraphrases", () => {
    const safe = (claimEvals as ClaimEval[])[0];
    expect(safe.verdict).toBe("safe");
    expect(safe.paraphrases.every((p) => p.verdict === "safe")).toBe(true);
  });

  test("paraphrased risky claim is still caught", () => {
    const risky = (claimEvals as ClaimEval[])[1];
    expect(risky.verdict).toBe("blocked");
    expect(risky.paraphrases.map((p) => p.verdict)).toContain("blocked");
    expect(risky.paraphrases.map((p) => p.verdict)).toContain("needs-proof");
  });

  test("rejects empty paraphrases and unknown verdict", () => {
    const base = (claimEvals as ClaimEval[])[0];
    expect(validate(claimEvalSchema, { ...base, paraphrases: [] })).toBe(false);
    expect(validate(claimEvalSchema, { ...base, verdict: "maybe" })).toBe(false);
  });
});

describe("ComplianceCheck contract", () => {
  test("fixtures satisfy the schema", () => {
    for (const check of complianceChecks as ComplianceCheck[]) {
      expect(validate(complianceCheckSchema, check)).toBe(true);
    }
  });

  test("fail cases are blocked with reasons (no send)", () => {
    const blocked = (complianceChecks as ComplianceCheck[]).filter((c) => c.verdict === "blocked");
    expect(blocked).toHaveLength(3);
    for (const check of blocked) {
      expect(check.blockedReasons!.length).toBeGreaterThan(0);
    }
    const reasons = blocked.flatMap((c) => c.blockedReasons!);
    expect(reasons.join(" ")).toMatch(/consent/);
    expect(reasons.join(" ")).toMatch(/unsubscribe/);
    expect(reasons.join(" ")).toMatch(/authentication/i);
  });

  test("blocked without reasons and bad consentBasis are rejected", () => {
    const base = (complianceChecks as ComplianceCheck[])[1];
    const withoutReasons: Record<string, unknown> = { ...base };
    delete withoutReasons.blockedReasons;
    expect(validate(complianceCheckSchema, withoutReasons)).toBe(false);
    expect(validate(complianceCheckSchema, { ...base, consentBasis: "vibes" })).toBe(false);
  });
});

describe("ProofpackManifest contract", () => {
  test("fixture satisfies the schema", () => {
    expect(validate(proofpackManifestSchema, proofpackManifest as ProofpackManifest)).toBe(true);
  });

  test("rejects malformed hashes and empty runs", () => {
    const base = proofpackManifest as ProofpackManifest;
    expect(validate(proofpackManifestSchema, { ...base, packSha256: "tampered" })).toBe(false);
    expect(validate(proofpackManifestSchema, { ...base, runs: [] })).toBe(false);
    expect(
      validate(proofpackManifestSchema, { ...base, runs: [{ ...base.runs[0], mode: "live" }] })
    ).toBe(false);
  });
});

describe("cross-contract integrity", () => {
  test("every fixture tenantId exists in the tenant roster", () => {
    const roster = new Set((tenants as BetaTenant[]).map((t) => t.tenantId));
    for (const e of entitlements as Entitlement[]) expect(roster.has(e.tenantId)).toBe(true);
    for (const c of complianceChecks as ComplianceCheck[]) expect(roster.has(c.tenantId)).toBe(true);
    expect(roster.has((proofpackManifest as ProofpackManifest).tenantId)).toBe(true);
    for (const e of claimEvals as ClaimEval[]) {
      if (e.tenantId != null) expect(roster.has(e.tenantId)).toBe(true);
    }
  });

  test("every roster tenant has an entitlement", () => {
    const entitled = new Set((entitlements as Entitlement[]).map((e) => e.tenantId));
    for (const t of tenants as BetaTenant[]) expect(entitled.has(t.tenantId)).toBe(true);
  });
});
