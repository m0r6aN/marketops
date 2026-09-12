/**
 * w1-auth-middleware-scope — beta roster + session cookie contract.
 *
 * Edge-safe by design: this module has NO Node.js imports so that
 * middleware.ts (Edge runtime) can import it. The HMAC signing/verification
 * itself lives in ./session.ts (Node crypto) for server actions, API routes,
 * and tests; middleware.ts carries a small Web-Crypto mirror of the same
 * token format and MUST be kept in sync with it (see the sync note there).
 *
 * Roster source: this constant mirrors tests/contracts/fixtures/tenants.json
 * (tenant-keon, tenant-biostack). A DB-backed roster is out of scope for this
 * parcel (DB schema changes are forbidden); keep the two in sync manually
 * until the roster moves to a real store.
 */

export const SESSION_COOKIE_NAME = "marketops_session";

/** Canonical beta-roster tenantIds. Every authenticated session carries one of these. */
export const BETA_ROSTER_TENANT_IDS: readonly string[] = ["tenant-keon", "tenant-biostack"];

export function isRosterTenant(tenantId: unknown): tenantId is string {
  return (
    typeof tenantId === "string" &&
    (BETA_ROSTER_TENANT_IDS as readonly string[]).includes(tenantId)
  );
}
