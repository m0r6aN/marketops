/**
 * w1-auth-middleware-scope — deny-by-default edge gate for tenant surfaces.
 *
 * Protected: /initiatives/*, /campaigns/*, /library/* and API siblings (/api/*).
 * Public (never matched here, no session required): /, /waitlist, /beta,
 * static assets (/_next/*, /favicon.ico, /public files).
 *
 * Per-surface unauthenticated behavior (deliberate choice):
 * - Pages  -> redirect to /waitlist (human-friendly beta gate).
 * - APIs   -> 401 JSON { error, denialCode: "UNAUTHENTICATED", denialMessage,
 *   failureStage: "decision" }.
 *
 * TOKEN SYNC NOTE: session issue/verify of record lives in
 * src/lib/auth/session.ts (Node crypto HMAC-SHA256, key
 * MARKETOPS_FC_HMAC_KEY). This file MUST NOT import it (Edge runtime has no
 * node:crypto statics), so verifySessionTokenEdge() below mirrors that format
 * (body.sig over base64url(payloadJSON)) with Web Crypto. Keep the two in
 * sync: payload { v: 1, tenantId, iat, exp, jti }, roster check against
 * src/lib/auth/roster.ts, 60s iat-skew, exp > now. Fail-closed: missing key,
 * malformed token, bad signature, expiry, or non-roster tenant => denied.
 */

import { NextResponse, type NextRequest } from "next/server";

import { BETA_ROSTER_TENANT_IDS, SESSION_COOKIE_NAME } from "@/lib/auth/roster";

export const config = {
  matcher: [
    "/initiatives/:path*",
    "/campaigns/:path*",
    "/library/:path*",
    "/api/:path*",
  ],
};

const MIN_HMAC_KEY_CHARS = 16;
const ISSUED_AT_SKEW_SEC = 60;

function b64urlToBytes(input: string): Uint8Array | null {
  if (!input || input.length > 8192 || !/^[A-Za-z0-9_-]+$/.test(input)) return null;
  let b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  if (pad === 1) return null;
  if (pad > 0) b64 += "=".repeat(4 - pad);
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

interface EdgeSessionPayload {
  v?: unknown;
  tenantId?: unknown;
  iat?: unknown;
  exp?: unknown;
}

/** Web-Crypto mirror of session.ts verifySessionToken. Returns tenantId or null. */
async function verifySessionTokenEdge(
  token: string,
  keyMaterial: string,
  nowSec: number,
): Promise<string | null> {
  try {
    const dot = token.indexOf(".");
    if (dot <= 0 || dot === token.length - 1) return null;
    const body = token.slice(0, dot);
    const sigBytes = b64urlToBytes(token.slice(dot + 1));
    if (!sigBytes) return null;
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(keyMaterial),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      cryptoKey,
      sigBytes,
      new TextEncoder().encode(body),
    );
    if (!valid) return null;
    const payloadBytes = b64urlToBytes(body);
    if (!payloadBytes) return null;
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as EdgeSessionPayload;
    if (payload.v !== 1 || typeof payload.tenantId !== "string") return null;
    if (!(BETA_ROSTER_TENANT_IDS as readonly string[]).includes(payload.tenantId)) return null;
    if (!Number.isInteger(payload.iat) || !Number.isInteger(payload.exp)) return null;
    const iat = payload.iat as number;
    const exp = payload.exp as number;
    if (exp <= nowSec) return null;
    if (iat > nowSec + ISSUED_AT_SKEW_SEC) return null;
    if (exp <= iat) return null;
    return payload.tenantId;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname === "/api" || pathname.startsWith("/api/");

  const deny = () => {
    if (isApi) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          denialCode: "UNAUTHENTICATED",
          denialMessage: "API access denied: no authenticated tenant session.",
          failureStage: "decision",
        },
        { status: 401 },
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/waitlist";
    url.search = "";
    return NextResponse.redirect(url);
  };

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
  const keyMaterial = (process.env.MARKETOPS_FC_HMAC_KEY ?? "").trim();
  // Fail-closed: no token or no key => denied. No redirect loops: /waitlist is
  // public (not in matcher), so denied pages always land somewhere public.
  if (!token || keyMaterial.length < MIN_HMAC_KEY_CHARS) return deny();

  const tenantId = await verifySessionTokenEdge(
    token,
    keyMaterial,
    Math.floor(Date.now() / 1000),
  );
  if (!tenantId) return deny();

  return NextResponse.next();
}
