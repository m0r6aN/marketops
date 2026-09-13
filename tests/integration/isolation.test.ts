/**
 * int-a-isolation — tenant+auth isolation end to end at the service/action
 * layer (local env, scenario int-tenant-isolation, surfaces S1+S2).
 *
 * COMPOSED coverage only (reuse, don't duplicate):
 * - tests/auth/session-scope.test.ts proves token issue/verify + pure guard
 *   shapes in isolation.
 * - tests/tenant-wire/tenant-wire.test.ts proves repository predicates +
 *   migration/SQL semantics in isolation.
 * - THIS suite proves the composed session -> guard -> predicate chain per
 *   lane: issueSessionToken -> requireSessionTenant({ token }) ->
 *   requireRowTenantMatch(sessionTenant, row, action) (+ isRowVisibleToTenant
 *   for reads). A break at any link (wrong token, cross-tenant row, null
 *   session, unknown tenant) must deny with the GateResult-mirrored denial
 *   SHAPE (denialCode / denialMessage / failureStage + HTTP mapping), not
 *   just "it threw".
 *
 * Lanes: initiatives, library, persuasion-review (read + write each).
 * No DB writes: rows are tenant-tagged in-memory records (see fixtures);
 * live PG RLS (runbook R1-R7) is deferred to INT-beta.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  TenantScopeError,
  assertTenantAccess,
  issueSessionToken,
  requireSessionTenant,
  requireTenantMatch,
  verifySessionToken,
} from "@/lib/auth/session";
import {
  isRowVisibleToTenant as isInitiativeRowVisible,
  requireRowTenantMatch as requireInitiativeRowTenant,
} from "@/lib/initiatives/repository";
import {
  isRowVisibleToTenant as isLibraryRowVisible,
  requireRowTenantMatch as requireLibraryRowTenant,
} from "@/lib/library/repository";
import {
  isRowVisibleToTenant as isPersuasionRowVisible,
  requireRowTenantMatch as requirePersuasionRowTenant,
} from "@/lib/persuasion-review/repository";

import {
  BIOSTACK,
  KEON,
  TEST_HMAC_KEY,
  UNKNOWN_TENANT,
  keonInitiativeRow,
  keonLibraryRow,
  keonPersuasionRow,
  tamperToken,
} from "./fixtures/tenants";

interface LaneGuard {
  lane: string;
  action: string;
  keonRow: () => Record<string, unknown>;
  requireRow: (
    sessionTenantId: string,
    row: unknown,
    action: string,
  ) => string;
  isVisible: (sessionTenantId: string, row: unknown) => boolean;
}

const LANES: LaneGuard[] = [
  {
    lane: "initiatives",
    action: "isolation probe initiative write",
    keonRow: keonInitiativeRow,
    requireRow: requireInitiativeRowTenant,
    isVisible: isInitiativeRowVisible,
  },
  {
    lane: "library",
    action: "isolation probe library write",
    keonRow: keonLibraryRow,
    requireRow: requireLibraryRowTenant,
    isVisible: isLibraryRowVisible,
  },
  {
    lane: "persuasion-review",
    action: "isolation probe persuasion write",
    keonRow: keonPersuasionRow,
    requireRow: requirePersuasionRowTenant,
    isVisible: isPersuasionRowVisible,
  },
];

let savedKey: string | undefined;

beforeEach(() => {
  savedKey = process.env.MARKETOPS_FC_HMAC_KEY;
  process.env.MARKETOPS_FC_HMAC_KEY = TEST_HMAC_KEY;
});

afterEach(() => {
  if (savedKey === undefined) delete process.env.MARKETOPS_FC_HMAC_KEY;
  else process.env.MARKETOPS_FC_HMAC_KEY = savedKey;
});

/** Full composed write path: token -> session tenant -> row predicate. */
async function guardedWrite(
  token: string | null,
  row: unknown,
  guard: LaneGuard,
): Promise<string> {
  const sessionTenant = await requireSessionTenant({
    token,
    action: guard.action,
  });
  return guard.requireRow(sessionTenant, row, guard.action);
}

/** Full composed read path: token -> session tenant -> visibility gate. */
async function guardedRead(
  token: string | null,
  row: unknown,
  guard: LaneGuard,
): Promise<string> {
  const sessionTenant = await requireSessionTenant({
    token,
    action: guard.action,
  });
  if (!guard.isVisible(sessionTenant, row)) {
    // Route through the throwing predicate so denials keep their shape.
    return guard.requireRow(sessionTenant, row, guard.action);
  }
  return guard.requireRow(sessionTenant, row, guard.action);
}

async function catchGuarded(
  fn: () => Promise<unknown>,
): Promise<TenantScopeError> {
  try {
    await fn();
  } catch (error) {
    expect(error).toBeInstanceOf(TenantScopeError);
    return error as TenantScopeError;
  }
  throw new Error("Expected TenantScopeError but the composed call succeeded.");
}

function expectMismatchShape(
  error: TenantScopeError,
  guard: LaneGuard,
  sessionTenant: string,
): void {
  expect(error.httpStatus).toBe(403);
  expect(error.denialCode).toBe("TENANT_MISMATCH");
  expect(error.failureStage).toBe("decision");
  expect(error.denialMessage).toContain(guard.action);
  expect(error.denialMessage).toContain(sessionTenant);
  expect(error.denialMessage).toContain(KEON);
  expect(error.toResponseBody()).toEqual({
    error: "Forbidden",
    denialCode: "TENANT_MISMATCH",
    denialMessage: error.denialMessage,
    failureStage: "decision",
  });
}

function expectUnauthenticatedShape(
  error: TenantScopeError,
  action: string,
): void {
  expect(error.httpStatus).toBe(401);
  expect(error.denialCode).toBe("UNAUTHENTICATED");
  expect(error.failureStage).toBe("decision");
  expect(error.denialMessage).toContain(action);
  expect(error.toResponseBody()).toEqual({
    error: "Unauthorized",
    denialCode: "UNAUTHENTICATED",
    denialMessage: error.denialMessage,
    failureStage: "decision",
  });
}

// ── positive: keon session reads/writes keon rows in every lane ─────────────

describe("positive — keon session serves keon rows (all lanes)", () => {
  for (const guard of LANES) {
    test(`${guard.lane}: composed read + write allow own-tenant rows`, async () => {
      const token = issueSessionToken(KEON);
      expect(verifySessionToken(token)?.tenantId).toBe(KEON);

      const row = guard.keonRow();
      await expect(guardedRead(token, row, guard)).resolves.toBe(KEON);
      await expect(guardedWrite(token, row, guard)).resolves.toBe(KEON);
      expect(guard.isVisible(KEON, row)).toBe(true);
    });
  }
});

// ── negative: biostack session on keon rows + tampered token ────────────────

describe("negative — cross-tenant and forged sessions denied (all lanes)", () => {
  for (const guard of LANES) {
    test(`${guard.lane}: biostack session on keon rows -> 403 TENANT_MISMATCH`, async () => {
      const token = issueSessionToken(BIOSTACK);
      expect(verifySessionToken(token)?.tenantId).toBe(BIOSTACK);

      const row = guard.keonRow();
      expect(guard.isVisible(BIOSTACK, row)).toBe(false);

      const readError = await catchGuarded(() => guardedRead(token, row, guard));
      expectMismatchShape(readError, guard, BIOSTACK);

      const writeError = await catchGuarded(() =>
        guardedWrite(token, row, guard),
      );
      expectMismatchShape(writeError, guard, BIOSTACK);
    });
  }

  test("tampered keon token -> 401 UNAUTHENTICATED on every lane", async () => {
    const tampered = tamperToken(issueSessionToken(KEON));
    expect(verifySessionToken(tampered)).toBeNull();
    for (const guard of LANES) {
      const error = await catchGuarded(() =>
        guardedWrite(tampered, guard.keonRow(), guard),
      );
      expectUnauthenticatedShape(error, guard.action);
    }
  });
});

// ── failure: null session + unknown tenant deny fail-closed ─────────────────

describe("failure — null session and unknown tenants denied", () => {
  test("null session token -> 401 UNAUTHENTICATED (guard + enforcement shapes)", async () => {
    for (const guard of LANES) {
      const error = await catchGuarded(() =>
        guardedWrite(null, guard.keonRow(), guard),
      );
      expectUnauthenticatedShape(error, guard.action);
    }

    const denial = assertTenantAccess(null, KEON, "isolation probe read");
    expect(denial.ok).toBe(false);
    if (denial.ok) throw new Error("unreachable");
    expect(denial.denial).toMatchObject({
      allowed: false,
      denialCode: "UNAUTHENTICATED",
      failureStage: "decision",
      httpStatus: 401,
    });
    expect(denial.denial.denialMessage.length).toBeGreaterThan(0);
    expect(denial.denial.receiptId.length).toBeGreaterThan(0);
  });

  test("unknown resource tenant -> 403 TENANT_MISMATCH fail-closed", () => {
    const denial = assertTenantAccess(KEON, null, "isolation probe read");
    expect(denial.ok).toBe(false);
    if (denial.ok) throw new Error("unreachable");
    expect(denial.denial).toMatchObject({
      allowed: false,
      denialCode: "TENANT_MISMATCH",
      failureStage: "decision",
      httpStatus: 403,
    });
    expect(denial.denial.denialMessage).toContain("unknown");

    for (const resource of [null, "", undefined]) {
      let caught: TenantScopeError | null = null;
      try {
        requireTenantMatch(KEON, resource, "isolation probe write");
      } catch (error) {
        caught = error as TenantScopeError;
      }
      expect(caught).toBeInstanceOf(TenantScopeError);
      expect(caught?.httpStatus).toBe(403);
      expect(caught?.denialCode).toBe("TENANT_MISMATCH");
      expect(caught?.failureStage).toBe("decision");
    }
  });

  test("unknown session tenant -> denied (issue refused, guard 401)", () => {
    expect(() => issueSessionToken(UNKNOWN_TENANT)).toThrowError();
    expect(() => issueSessionToken("")).toThrowError();

    const denial = assertTenantAccess(
      UNKNOWN_TENANT,
      KEON,
      "isolation probe read",
    );
    expect(denial.ok).toBe(false);
    if (denial.ok) throw new Error("unreachable");
    expect(denial.denial).toMatchObject({
      allowed: false,
      denialCode: "UNAUTHENTICATED",
      failureStage: "decision",
      httpStatus: 401,
    });
  });
});
