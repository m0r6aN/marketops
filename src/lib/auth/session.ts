/**
 * w1-auth-middleware-scope — roster-backed tenant session + deny-by-default scope guard.
 *
 * Surface policy (deliberate per-surface choice, documented here):
 * - Pages under /initiatives, /campaigns, /library: middleware redirects
 *   unauthenticated browsers to /waitlist (human-friendly).
 * - APIs under /api/*: middleware and route handlers return 401 JSON
 *   { error, denialCode: "UNAUTHENTICATED", denialMessage, failureStage: "decision" }.
 * - Authenticated sessions carry a beta-roster tenantId; any access where the
 *   session tenant != resource tenant is denied with 403 and a
 *   GateResult-mirrored denial (denialCode TENANT_MISMATCH, denialMessage,
 *   failureStage "decision").
 *
 * Session = HMAC-SHA256 signed token (Node crypto, key MARKETOPS_FC_HMAC_KEY)
 * in the httpOnly `marketops_session` cookie. Fail-closed everywhere: missing
 * key, bad signature, expiry, or non-roster tenant => unauthenticated. This
 * module never fails open.
 *
 * Denial vocabulary promotes tools/spike/tenant-deny-receipt/run.mjs:
 * UNAUTHENTICATED / TENANT_MISMATCH denial codes plus receipt fields
 * (receiptId, tenantId, requestedTenantId, denialMessage, decidedAtUtc),
 * mirrored onto the contracts/GateResult.json denial fields
 * (allowed, denialCode, denialMessage, failureStage).
 *
 * Email magic-link DELIVERY is initiative-wide out of scope: there is NO SMTP
 * / send code in this parcel. Beta-only LOCAL single-use codes
 * (issueLocalBetaCode / redeemLocalBetaCode, gated by
 * MARKETOPS_LOCAL_CODES_ENABLED=true) exist for dogfood operators only.
 * Real outbound delivery is a deferred follow-up (see PR).
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import {
  BETA_ROSTER_TENANT_IDS,
  SESSION_COOKIE_NAME,
  isRosterTenant,
} from "./roster";

export { BETA_ROSTER_TENANT_IDS, SESSION_COOKIE_NAME, isRosterTenant };

// ─────────────────────────────────────────────────────────────────────────────
// Key management (fail-closed)
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum accepted HMAC key length. Shorter/missing keys => unauthenticated. */
const MIN_HMAC_KEY_CHARS = 16;

/**
 * Resolve the HMAC key. Returns null when the key is missing or too short;
 * every caller treats null as "deny" (fail-closed). Tests may pass an
 * explicit key instead of touching process.env.
 */
export function getHmacKey(explicitKey?: string): Buffer | null {
  const raw = (explicitKey ?? process.env.MARKETOPS_FC_HMAC_KEY ?? "").trim();
  if (raw.length < MIN_HMAC_KEY_CHARS) return null;
  return Buffer.from(raw, "utf8");
}

// ─────────────────────────────────────────────────────────────────────────────
// Token format: base64url(payloadJSON) + "." + base64url(HMAC_SHA256(key, body))
// Payload: { v: 1, tenantId, iat (sec), exp (sec), jti }
// ─────────────────────────────────────────────────────────────────────────────

/** Default session lifetime: 12 hours. */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** Allowed clock skew for iat-in-future checks: 60 seconds. */
const ISSUED_AT_SKEW_SEC = 60;

interface SessionPayload {
  v: 1;
  tenantId: string;
  iat: number;
  exp: number;
  jti: string;
}

export interface VerifiedSession {
  tenantId: string;
  issuedAtUtc: string;
  expiresAtUtc: string;
}

function b64urlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64url");
}

function b64urlDecode(input: string): Buffer | null {
  if (typeof input !== "string" || input.length === 0 || input.length > 8192) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(input)) return null;
  try {
    return Buffer.from(input, "base64url");
  } catch {
    return null;
  }
}

/**
 * Mint a signed session token for a beta-roster tenant. Throws (fail-closed)
 * for non-roster tenants or when no HMAC key is configured.
 */
export function issueSessionToken(
  tenantId: string,
  opts?: { ttlMs?: number; nowMs?: number; key?: string },
): string {
  if (!isRosterTenant(tenantId)) {
    throw new Error(`Cannot issue session: "${tenantId}" is not a beta-roster tenant.`);
  }
  const key = getHmacKey(opts?.key);
  if (!key) {
    throw new Error(
      "Cannot issue session: MARKETOPS_FC_HMAC_KEY is missing or too short (fail-closed).",
    );
  }
  const nowMs = opts?.nowMs ?? Date.now();
  const ttlMs = opts?.ttlMs ?? SESSION_TTL_MS;
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error("Cannot issue session: ttlMs must be a positive number.");
  }
  const payload: SessionPayload = {
    v: 1,
    tenantId,
    iat: Math.floor(nowMs / 1000),
    exp: Math.floor((nowMs + ttlMs) / 1000),
    jti: randomBytes(12).toString("base64url"),
  };
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = b64urlEncode(createHmac("sha256", key).update(body, "utf8").digest());
  return `${body}.${sig}`;
}

/**
 * Verify a session token. Returns the session or null (never throws for
 * untrusted input): null on missing key, malformed token, bad signature,
 * expiry, future-issued token, or non-roster tenant.
 */
export function verifySessionToken(
  token: unknown,
  opts?: { nowMs?: number; key?: string },
): VerifiedSession | null {
  const key = getHmacKey(opts?.key);
  if (!key) return null;
  if (typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const body = token.slice(0, dot);
  const sigBytes = b64urlDecode(token.slice(dot + 1));
  if (!sigBytes) return null;
  const expected = createHmac("sha256", key).update(body, "utf8").digest();
  if (sigBytes.length !== expected.length || !timingSafeEqual(sigBytes, expected)) return null;
  const payloadBytes = b64urlDecode(body);
  if (!payloadBytes) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadBytes.toString("utf8")) as unknown;
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const payload = parsed as Partial<SessionPayload>;
  if (payload.v !== 1 || !isRosterTenant(payload.tenantId)) return null;
  if (!Number.isInteger(payload.iat) || !Number.isInteger(payload.exp)) return null;
  const iat = payload.iat as number;
  const exp = payload.exp as number;
  const nowSec = Math.floor((opts?.nowMs ?? Date.now()) / 1000);
  if (exp <= nowSec) return null;
  if (iat > nowSec + ISSUED_AT_SKEW_SEC) return null;
  if (exp <= iat) return null;
  return {
    tenantId: payload.tenantId,
    issuedAtUtc: new Date(iat * 1000).toISOString(),
    expiresAtUtc: new Date(exp * 1000).toISOString(),
  };
}

/** Extract the raw session token from a Cookie header value (null when absent). */
export function parseSessionCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    if (part.slice(0, idx).trim() === SESSION_COOKIE_NAME) {
      const value = part.slice(idx + 1).trim();
      return value.length > 0 ? value : null;
    }
  }
  return null;
}

/** Serialize the httpOnly session cookie (pairs with middleware's reader). */
export function buildSessionCookie(
  token: string,
  opts?: { maxAgeSec?: number; secure?: boolean },
): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${opts?.maxAgeSec ?? Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (opts?.secure ?? process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

/** Serialize an expired session cookie (logout). */
export function buildExpiredSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Denials: spike vocabulary promoted + GateResult mirror
// ─────────────────────────────────────────────────────────────────────────────

export type DenialCode = "UNAUTHENTICATED" | "TENANT_MISMATCH";

/**
 * Denial receipt. GateResult mirror fields (allowed, denialCode,
 * denialMessage, failureStage) plus spike receipt fields (receiptId, tenantId,
 * requestedTenantId, decidedAtUtc) plus the HTTP mapping (httpStatus) and the
 * action that was denied.
 */
export interface TenantDenial {
  allowed: false;
  denialCode: DenialCode;
  denialMessage: string;
  failureStage: "decision";
  httpStatus: 401 | 403;
  receiptId: string;
  tenantId: string | null;
  requestedTenantId: string | null;
  decidedAtUtc: string;
  action: string;
}

function newReceiptId(suffix: string): string {
  return `den-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}-${suffix}`;
}

export function unauthenticatedDenial(
  action: string,
  opts?: { tenantId?: string | null },
): TenantDenial {
  const act = action && action.trim().length > 0 ? action : "access";
  return {
    allowed: false,
    denialCode: "UNAUTHENTICATED",
    denialMessage: `${act} denied: no authenticated tenant session`,
    failureStage: "decision",
    httpStatus: 401,
    receiptId: newReceiptId("nosession"),
    tenantId: opts?.tenantId ?? null,
    requestedTenantId: null,
    decidedAtUtc: new Date().toISOString(),
    action: act,
  };
}

export function tenantMismatchDenial(
  sessionTenantId: string,
  resourceTenantId: string | null,
  action: string,
  reason?: string,
): TenantDenial {
  const act = action && action.trim().length > 0 ? action : "access";
  const detail = reason ?? `tenant ${sessionTenantId} cannot access ${resourceTenantId} data`;
  return {
    allowed: false,
    denialCode: "TENANT_MISMATCH",
    denialMessage: `${act} denied: ${detail}`,
    failureStage: "decision",
    httpStatus: 403,
    receiptId: newReceiptId("mismatch"),
    tenantId: resourceTenantId,
    requestedTenantId: sessionTenantId,
    decidedAtUtc: new Date().toISOString(),
    action: act,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure guard (promotes the spike `guard` to product code)
// ─────────────────────────────────────────────────────────────────────────────

export type TenantAccessGrant = { ok: true; tenantId: string };
export type TenantAccessResult = TenantAccessGrant | { ok: false; denial: TenantDenial };

/**
 * Deny-by-default tenant guard. Never throws open:
 * - empty/non-roster session tenant => UNAUTHENTICATED (401)
 * - empty resource tenant => TENANT_MISMATCH (403, fail-closed: unknown owner)
 * - session tenant != resource tenant => TENANT_MISMATCH (403)
 * - equal => grant
 */
export function assertTenantAccess(
  sessionTenantId: string | null | undefined,
  resourceTenantId: string | null | undefined,
  action: string,
): TenantAccessResult {
  const act = action && action.trim().length > 0 ? action : "access";
  if (
    typeof sessionTenantId !== "string" ||
    sessionTenantId.length === 0 ||
    !isRosterTenant(sessionTenantId)
  ) {
    return { ok: false, denial: unauthenticatedDenial(act) };
  }
  if (typeof resourceTenantId !== "string" || resourceTenantId.length === 0) {
    return {
      ok: false,
      denial: tenantMismatchDenial(
        sessionTenantId,
        resourceTenantId ?? null,
        act,
        "resource tenant is unknown",
      ),
    };
  }
  if (sessionTenantId !== resourceTenantId) {
    return { ok: false, denial: tenantMismatchDenial(sessionTenantId, resourceTenantId, act) };
  }
  return { ok: true, tenantId: sessionTenantId };
}

/** Structured error thrown by server-side session enforcement. */
export class TenantScopeError extends Error {
  readonly httpStatus: 401 | 403;
  readonly denialCode: DenialCode;
  readonly denialMessage: string;
  readonly failureStage = "decision" as const;
  readonly tenantId: string | null;
  readonly requestedTenantId: string | null;
  readonly action: string;

  constructor(denial: TenantDenial) {
    super(denial.denialMessage);
    this.name = "TenantScopeError";
    this.httpStatus = denial.httpStatus;
    this.denialCode = denial.denialCode;
    this.denialMessage = denial.denialMessage;
    this.tenantId = denial.tenantId;
    this.requestedTenantId = denial.requestedTenantId;
    this.action = denial.action;
  }

  toDenial(): TenantDenial {
    return {
      allowed: false,
      denialCode: this.denialCode,
      denialMessage: this.denialMessage,
      failureStage: this.failureStage,
      httpStatus: this.httpStatus,
      receiptId: newReceiptId("error"),
      tenantId: this.tenantId,
      requestedTenantId: this.requestedTenantId,
      decidedAtUtc: new Date().toISOString(),
      action: this.action,
    };
  }

  toResponseBody(): {
    error: string;
    denialCode: DenialCode;
    denialMessage: string;
    failureStage: "decision";
  } {
    return {
      error: this.httpStatus === 401 ? "Unauthorized" : "Forbidden",
      denialCode: this.denialCode,
      denialMessage: this.denialMessage,
      failureStage: this.failureStage,
    };
  }
}

/** Enforce an explicit tenant match; throws TenantScopeError (403/401) on denial. */
export function requireTenantMatch(
  sessionTenantId: string | null | undefined,
  resourceTenantId: string | null | undefined,
  action: string,
): string {
  const result = assertTenantAccess(sessionTenantId, resourceTenantId, action);
  if (!result.ok) throw new TenantScopeError(result.denial);
  return result.tenantId;
}

/**
 * Server-side session enforcement for actions and routes.
 * - No/invalid token (or no HMAC key) => throws 401 UNAUTHENTICATED.
 * - resourceTenantId supplied and != session tenant => throws 403 TENANT_MISMATCH.
 * - Otherwise returns the authenticated roster tenantId.
 *
 * Reads the session cookie via next/headers when no explicit token is passed;
 * cookie-read failures (e.g. outside request scope) are treated as
 * unauthenticated (fail-closed), never as errors.
 */
export async function requireSessionTenant(
  opts?: { resourceTenantId?: string | null; action?: string; token?: string | null },
): Promise<string> {
  const action = opts?.action ?? "access";
  let token = opts?.token ?? null;
  if (token == null) {
    try {
      const { cookies } = await import("next/headers");
      token = (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? null;
    } catch {
      token = null;
    }
  }
  const session = verifySessionToken(token);
  if (!session) throw new TenantScopeError(unauthenticatedDenial(action));
  if (opts?.resourceTenantId != null) {
    return requireTenantMatch(session.tenantId, opts.resourceTenantId, action);
  }
  return session.tenantId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Beta-only LOCAL single-use code issuer (dogfood operators, NO email)
// ─────────────────────────────────────────────────────────────────────────────

/** Default local-code lifetime: 15 minutes. */
export const LOCAL_BETA_CODE_TTL_MS = 15 * 60 * 1000;

interface LocalBetaCodeRecord {
  code: string;
  tenantId: string;
  expiresAtMs: number;
  used: boolean;
  issuedAtUtc: string;
}

export interface LocalCodeAuditEvent {
  event: "issued" | "redeemed" | "rejected";
  tenantId: string | null;
  /** SHA-256 fingerprint prefix (never the code itself). */
  codeFingerprint: string;
  atUtc: string;
  reason?: string;
}

const localBetaCodes = new Map<string, LocalBetaCodeRecord>();
const localCodeAudit: LocalCodeAuditEvent[] = [];

function codeFingerprint(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex").slice(0, 12);
}

function auditLocalCode(event: LocalCodeAuditEvent): void {
  localCodeAudit.push(event);
  // Audit-logged by design; logs carry tenant + fingerprint only, never the code.
  console.info(
    `[auth:local-code] ${event.event} tenant=${event.tenantId ?? "-"} fp=${event.codeFingerprint}` +
      (event.reason ? ` reason=${event.reason}` : ""),
  );
}

/**
 * Whether the LOCAL beta-code issuer is enabled. Explicit opt-in only:
 * MARKETOPS_LOCAL_CODES_ENABLED=true. Disabled by default in every
 * environment (fail-closed); dogfood operators enable it locally.
 */
export function isLocalBetaCodeIssuerEnabled(): boolean {
  return process.env.MARKETOPS_LOCAL_CODES_ENABLED === "true";
}

/**
 * Mint a single-use LOCAL beta code for a roster tenant (dogfood operator
 * helper). No email is sent — the code is returned to the operator caller.
 * Throws when the issuer is disabled or the tenant is not on the roster.
 */
export function issueLocalBetaCode(
  tenantId: string,
  opts?: { ttlMs?: number; nowMs?: number },
): string {
  if (!isLocalBetaCodeIssuerEnabled()) {
    throw new Error(
      "Local beta-code issuer is disabled (set MARKETOPS_LOCAL_CODES_ENABLED=true for dogfood operators).",
    );
  }
  if (!isRosterTenant(tenantId)) {
    throw new Error(`Cannot issue beta code: "${tenantId}" is not a beta-roster tenant.`);
  }
  const nowMs = opts?.nowMs ?? Date.now();
  const ttlMs = opts?.ttlMs ?? LOCAL_BETA_CODE_TTL_MS;
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error("Cannot issue beta code: ttlMs must be a positive number.");
  }
  const code = `mop-local-${randomBytes(16).toString("base64url")}`;
  localBetaCodes.set(code, {
    code,
    tenantId,
    expiresAtMs: nowMs + ttlMs,
    used: false,
    issuedAtUtc: new Date(nowMs).toISOString(),
  });
  auditLocalCode({
    event: "issued",
    tenantId,
    codeFingerprint: codeFingerprint(code),
    atUtc: new Date(nowMs).toISOString(),
  });
  return code;
}

/**
 * Redeem a single-use LOCAL beta code for a signed session token. Unknown,
 * already-used, or expired codes are denied with 401 UNAUTHENTICATED
 * (fail-closed); redemption marks the code used exactly once.
 */
export function redeemLocalBetaCode(
  code: string,
  opts?: { nowMs?: number; key?: string; sessionTtlMs?: number },
): string {
  const nowMs = opts?.nowMs ?? Date.now();
  const reject = (reason: string): never => {
    auditLocalCode({
      event: "rejected",
      tenantId: null,
      codeFingerprint: codeFingerprint(typeof code === "string" ? code : ""),
      atUtc: new Date(nowMs).toISOString(),
      reason,
    });
    throw new TenantScopeError({
      ...unauthenticatedDenial("redeem beta code"),
      denialMessage: `Redeem beta code denied: ${reason}.`,
    });
  };
  if (!isLocalBetaCodeIssuerEnabled()) reject("issuer disabled");
  const record = typeof code === "string" ? localBetaCodes.get(code) : undefined;
  if (!record) reject("unknown code");
  // (narrowed: record is defined past this point)
  const rec = record as LocalBetaCodeRecord;
  if (rec.used) reject("single-use code already redeemed");
  if (rec.expiresAtMs <= nowMs) reject("expired code");
  rec.used = true;
  auditLocalCode({
    event: "redeemed",
    tenantId: rec.tenantId,
    codeFingerprint: codeFingerprint(code),
    atUtc: new Date(nowMs).toISOString(),
  });
  return issueSessionToken(rec.tenantId, {
    nowMs,
    ttlMs: opts?.sessionTtlMs,
    key: opts?.key,
  });
}

/** Copy of the in-memory local-code audit log (fingerprint-only, no secrets). */
export function getLocalBetaCodeAuditLog(): LocalCodeAuditEvent[] {
  return [...localCodeAudit];
}

/** Test-only reset for the in-memory single-use code store + audit log. */
export function __testOnlyResetLocalBetaCodes(): void {
  localBetaCodes.clear();
  localCodeAudit.length = 0;
}
