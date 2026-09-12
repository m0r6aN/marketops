/**
 * w1-auth-middleware-scope — sec-auth gate evidence.
 *
 * - Unauthenticated => denied (401 UNAUTHENTICATED).
 * - Cross-tenant    => denied (403 TENANT_MISMATCH, GateResult-mirrored).
 * - Own-tenant      => allowed.
 * - Tampered/expired/wrong-key tokens => denied.
 * - No-key environment => everything denied (fail-closed, never open).
 * - Beta-only LOCAL single-use codes: happy path, replay, expiry,
 *   non-roster, and disabled-issuer cases (no email/SMTP anywhere).
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  __testOnlyResetLocalBetaCodes,
  assertTenantAccess,
  getLocalBetaCodeAuditLog,
  issueLocalBetaCode,
  issueSessionToken,
  parseSessionCookie,
  redeemLocalBetaCode,
  requireSessionTenant,
  requireTenantMatch,
  tenantMismatchDenial,
  TenantScopeError,
  unauthenticatedDenial,
  verifySessionToken,
} from "@/lib/auth/session";

const TEST_KEY = "test-hmac-key-for-session-scope-0123456789";
const OTHER_KEY = "different-test-hmac-key-9876543210abcd";
const KEON = "tenant-keon";
const BIOSTACK = "tenant-biostack";

let savedKey: string | undefined;
let savedFlag: string | undefined;

beforeEach(() => {
  savedKey = process.env.MARKETOPS_FC_HMAC_KEY;
  savedFlag = process.env.MARKETOPS_LOCAL_CODES_ENABLED;
  process.env.MARKETOPS_FC_HMAC_KEY = TEST_KEY;
  delete process.env.MARKETOPS_LOCAL_CODES_ENABLED;
  __testOnlyResetLocalBetaCodes();
});

afterEach(() => {
  if (savedKey === undefined) delete process.env.MARKETOPS_FC_HMAC_KEY;
  else process.env.MARKETOPS_FC_HMAC_KEY = savedKey;
  if (savedFlag === undefined) delete process.env.MARKETOPS_LOCAL_CODES_ENABLED;
  else process.env.MARKETOPS_LOCAL_CODES_ENABLED = savedFlag;
  __testOnlyResetLocalBetaCodes();
});

async function catchScopeError(promise: Promise<unknown>): Promise<TenantScopeError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(TenantScopeError);
    return error as TenantScopeError;
  }
  throw new Error("Expected TenantScopeError but the call succeeded.");
}

function tamper(token: string): string {
  const last = token[token.length - 1];
  const replacement = last === "A" ? "B" : "A";
  return `${token.slice(0, -1)}${replacement}`;
}

describe("unauthenticated access is denied (401)", () => {
  test("missing/empty tokens verify to null", () => {
    expect(verifySessionToken(null)).toBeNull();
    expect(verifySessionToken(undefined)).toBeNull();
    expect(verifySessionToken("")).toBeNull();
    expect(verifySessionToken("not-a-token")).toBeNull();
  });

  test("pure guard denies null session with UNAUTHENTICATED", () => {
    const result = assertTenantAccess(null, KEON, "library read");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.denial.allowed).toBe(false);
    expect(result.denial.denialCode).toBe("UNAUTHENTICATED");
    expect(result.denial.httpStatus).toBe(401);
    expect(result.denial.failureStage).toBe("decision");
    expect(result.denial.denialMessage.length).toBeGreaterThan(0);
  });

  test("requireSessionTenant without a token throws 401", async () => {
    const error = await catchScopeError(requireSessionTenant({ token: null, action: "write" }));
    expect(error.httpStatus).toBe(401);
    expect(error.denialCode).toBe("UNAUTHENTICATED");
    expect(error.failureStage).toBe("decision");
    expect(error.toResponseBody()).toEqual({
      error: "Unauthorized",
      denialCode: "UNAUTHENTICATED",
      denialMessage: error.denialMessage,
      failureStage: "decision",
    });
  });

  test("non-roster session tenant is treated as unauthenticated", () => {
    const result = assertTenantAccess("tenant-intruder", KEON, "read");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.denial.denialCode).toBe("UNAUTHENTICATED");
    expect(result.denial.httpStatus).toBe(401);
  });
});

describe("cross-tenant access is denied (403 TENANT_MISMATCH)", () => {
  test("pure guard denies mismatch with GateResult-mirrored denial", () => {
    const result = assertTenantAccess(BIOSTACK, KEON, "library read");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    const denial = result.denial;
    // GateResult mirror fields:
    expect(denial.allowed).toBe(false);
    expect(denial.denialCode).toBe("TENANT_MISMATCH");
    expect(denial.denialMessage).toContain(BIOSTACK);
    expect(denial.denialMessage).toContain(KEON);
    expect(denial.failureStage).toBe("decision");
    // HTTP mapping + receipt fields:
    expect(denial.httpStatus).toBe(403);
    expect(denial.tenantId).toBe(KEON);
    expect(denial.requestedTenantId).toBe(BIOSTACK);
    expect(denial.receiptId.length).toBeGreaterThan(0);
    expect(denial.decidedAtUtc.length).toBeGreaterThan(0);
  });

  test("requireTenantMatch throws 403 on mismatch", () => {
    let caught: TenantScopeError | null = null;
    try {
      requireTenantMatch(BIOSTACK, KEON, "import");
    } catch (error) {
      caught = error as TenantScopeError;
    }
    expect(caught).toBeInstanceOf(TenantScopeError);
    expect(caught?.httpStatus).toBe(403);
    expect(caught?.denialCode).toBe("TENANT_MISMATCH");
    expect(caught?.toResponseBody().error).toBe("Forbidden");
  });

  test("requireSessionTenant enforces an explicit resource tenant", async () => {
    const token = issueSessionToken(KEON);
    const error = await catchScopeError(
      requireSessionTenant({ token, resourceTenantId: BIOSTACK, action: "read" }),
    );
    expect(error.httpStatus).toBe(403);
    expect(error.denialCode).toBe("TENANT_MISMATCH");
  });

  test("unknown resource tenant is denied fail-closed (403)", () => {
    const result = assertTenantAccess(KEON, null, "read");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.denial.denialCode).toBe("TENANT_MISMATCH");
    expect(result.denial.httpStatus).toBe(403);
  });
});

describe("own-tenant access is allowed", () => {
  test("pure guard grants on tenant match", () => {
    expect(assertTenantAccess(KEON, KEON, "write")).toEqual({ ok: true, tenantId: KEON });
  });

  test("issued token verifies and authorizes its own tenant", async () => {
    const token = issueSessionToken(KEON);
    const session = verifySessionToken(token);
    expect(session?.tenantId).toBe(KEON);
    await expect(
      requireSessionTenant({ token, resourceTenantId: KEON, action: "read" }),
    ).resolves.toBe(KEON);
    await expect(requireSessionTenant({ token })).resolves.toBe(KEON);
  });

  test("issue rejects non-roster tenants", () => {
    expect(() => issueSessionToken("tenant-intruder")).toThrowError();
  });
});

describe("tampered/expired/wrong-key tokens are denied", () => {
  test("tampered signature fails verification and enforcement", async () => {
    const token = issueSessionToken(KEON);
    expect(verifySessionToken(tamper(token))).toBeNull();
    const error = await catchScopeError(requireSessionTenant({ token: tamper(token) }));
    expect(error.httpStatus).toBe(401);
    expect(error.denialCode).toBe("UNAUTHENTICATED");
  });

  test("expired token fails verification", () => {
    const expired = issueSessionToken(KEON, { ttlMs: 1000, nowMs: Date.now() - 5000 });
    expect(verifySessionToken(expired)).toBeNull();
  });

  test("token signed with a different key fails verification", () => {
    const foreign = issueSessionToken(KEON, { key: OTHER_KEY });
    expect(verifySessionToken(foreign)).toBeNull();
  });

  test("cookie parsing extracts the session token", () => {
    const token = issueSessionToken(KEON);
    expect(parseSessionCookie(`other=1; marketops_session=${token}; x=y`)).toBe(token);
    expect(parseSessionCookie("other=1")).toBeNull();
    expect(parseSessionCookie(null)).toBeNull();
  });
});

describe("no-key environment denies everything (fail-closed)", () => {
  test("verify returns null, issue throws, enforcement throws 401", async () => {
    const token = issueSessionToken(KEON);
    expect(verifySessionToken(token)).not.toBeNull();

    delete process.env.MARKETOPS_FC_HMAC_KEY;

    expect(verifySessionToken(token)).toBeNull();
    expect(() => issueSessionToken(KEON)).toThrowError();
    const error = await catchScopeError(requireSessionTenant({ token }));
    expect(error.httpStatus).toBe(401);
    expect(error.denialCode).toBe("UNAUTHENTICATED");
  });
});

describe("beta-only LOCAL single-use codes (no email)", () => {
  test("issuer is disabled by default", () => {
    expect(() => issueLocalBetaCode(KEON)).toThrowError(/disabled/);
  });

  test("issue -> redeem -> verified session; replay denied", () => {
    process.env.MARKETOPS_LOCAL_CODES_ENABLED = "true";
    const code = issueLocalBetaCode(KEON);
    expect(typeof code).toBe("string");

    const token = redeemLocalBetaCode(code);
    expect(verifySessionToken(token)?.tenantId).toBe(KEON);

    // Single-use: second redeem is denied 401.
    let caught: TenantScopeError | null = null;
    try {
      redeemLocalBetaCode(code);
    } catch (error) {
      caught = error as TenantScopeError;
    }
    expect(caught).toBeInstanceOf(TenantScopeError);
    expect(caught?.httpStatus).toBe(401);

    const audit = getLocalBetaCodeAuditLog();
    expect(audit.map((entry) => entry.event)).toEqual(["issued", "redeemed", "rejected"]);
    // Audit log never contains the code itself.
    expect(JSON.stringify(audit)).not.toContain(code);
  });

  test("expired codes are denied", () => {
    process.env.MARKETOPS_LOCAL_CODES_ENABLED = "true";
    const code = issueLocalBetaCode(KEON, { ttlMs: 1000, nowMs: Date.now() - 5000 });
    expect(() => redeemLocalBetaCode(code)).toThrowError(TenantScopeError);
  });

  test("non-roster tenants cannot get codes; unknown codes cannot redeem", () => {
    process.env.MARKETOPS_LOCAL_CODES_ENABLED = "true";
    expect(() => issueLocalBetaCode("tenant-intruder")).toThrowError();
    expect(() => redeemLocalBetaCode("mop-local-nope")).toThrowError(TenantScopeError);
  });
});

describe("denial builders mirror GateResult", () => {
  test("unauthenticated + mismatch denials carry allowed/denialCode/denialMessage/failureStage", () => {
    const unauth = unauthenticatedDenial("page view");
    expect(unauth).toMatchObject({
      allowed: false,
      denialCode: "UNAUTHENTICATED",
      failureStage: "decision",
      httpStatus: 401,
    });
    const mismatch = tenantMismatchDenial(BIOSTACK, KEON, "api call");
    expect(mismatch).toMatchObject({
      allowed: false,
      denialCode: "TENANT_MISMATCH",
      failureStage: "decision",
      httpStatus: 403,
      tenantId: KEON,
      requestedTenantId: BIOSTACK,
    });
  });
});
