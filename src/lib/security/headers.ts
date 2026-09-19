/**
 * rp-02-headers-ratelimit — Edge-safe security-header contract (single source).
 *
 * Edge-safe by design: no imports, no Node.js APIs. Imported by
 * `next.config.ts` (Node, via relative path) and `middleware.ts` (Edge
 * runtime, via `@/lib/security/headers`).
 *
 * Deliberately minimal: frame-sniffing/referrer/sensor headers that cannot
 * break app behavior. CSP and HSTS are out of scope for this parcel
 * (CSP needs per-route verification; HSTS is a beta/prod TLS decision).
 */

export const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};
