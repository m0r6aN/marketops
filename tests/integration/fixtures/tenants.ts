/**
 * int-a-isolation fixtures — BetaTenant composition inputs (local env).
 *
 * Canonical roster tenants only (mirrors src/lib/auth/roster.ts and
 * tests/contracts/fixtures/tenants.json): tenant-keon (active) and
 * tenant-biostack. Rows are in-memory tenant-tagged records — one key
 * spelling per lane (tenantId / tenant_id / tenant) to prove the
 * forward-compatible row predicate reads all three. No DB writes: local
 * sqlite rows predate tenant_id, so composition is proven at the
 * session -> guard -> predicate layer (live PG RLS is INT-beta scope).
 */

export const KEON = "tenant-keon";
export const BIOSTACK = "tenant-biostack";
export const UNKNOWN_TENANT = "tenant-intruder";

export const TEST_HMAC_KEY =
  "test-hmac-key-for-int-a-isolation-0123456789abcdef";

export function keonInitiativeRow(): Record<string, unknown> {
  return { tenantId: KEON, slug: "int-isolation-keon" };
}

export function keonLibraryRow(): Record<string, unknown> {
  return { tenant_id: KEON, id: "lib-isolation-keon" };
}

export function keonPersuasionRow(): Record<string, unknown> {
  return { tenant: KEON, id: "pr-isolation-keon" };
}

/** Flip the trailing signature character so HMAC verification must fail. */
export function tamperToken(token: string): string {
  const last = token[token.length - 1];
  return `${token.slice(0, -1)}${last === "A" ? "B" : "A"}`;
}
