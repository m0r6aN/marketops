/**
 * rp-02-headers-ratelimit — header contract + rate-limiter behavior (local).
 *
 * Covers: SECURITY_HEADERS map shape, next.config.ts headers() wiring, and
 * the fixed-window limiter (allow/burst/deny/reset/isolation/misconfig).
 * Middleware wiring itself is proven by build + live-header probe (see
 * parcel handoff); importing next/server's middleware into vitest is
 * deliberately avoided.
 */
import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";
import { SECURITY_HEADERS } from "@/lib/security/headers";
import { createRateLimiter } from "@/lib/security/rate-limit";

describe("security headers contract", () => {
  it("defines the minimal safe header set", () => {
    expect(SECURITY_HEADERS).toEqual({
      "X-Frame-Options": "SAMEORIGIN",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
  });

  it("next.config.ts applies the contract to every route", async () => {
    const routed = await nextConfig.headers?.();
    expect(routed).toBeDefined();
    const global = routed?.find((entry) => entry.source === "/:path*");
    expect(global).toBeDefined();
    const mapped = Object.fromEntries(
      (global?.headers ?? []).map((header) => [header.key, header.value]),
    );
    expect(mapped).toMatchObject(SECURITY_HEADERS);
  });
});

describe("fixed-window rate limiter", () => {
  it("allows up to the limit, then denies with reset info", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
    expect(limiter.check("ip-1", 0).allowed).toBe(true);
    expect(limiter.check("ip-1", 1).remaining).toBe(1);
    expect(limiter.check("ip-1", 2).remaining).toBe(0);
    const denied = limiter.check("ip-1", 3);
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.resetMs).toBeGreaterThan(0);
  });

  it("isolates keys from each other", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(limiter.check("a", 0).allowed).toBe(true);
    expect(limiter.check("a", 1).allowed).toBe(false);
    expect(limiter.check("b", 1).allowed).toBe(true);
  });

  it("resets when the window elapses", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000 });
    expect(limiter.check("a", 0).allowed).toBe(true);
    expect(limiter.check("a", 500).allowed).toBe(false);
    const after = limiter.check("a", 1_000);
    expect(after.allowed).toBe(true);
    expect(after.remaining).toBe(0);
  });

  it("treats blank keys as unknown without throwing", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(limiter.check("", 0).allowed).toBe(true);
    expect(limiter.check("", 1).allowed).toBe(false);
  });

  it("rejects misconfiguration at construction", () => {
    expect(() => createRateLimiter({ limit: 0, windowMs: 60_000 })).toThrow();
    expect(() => createRateLimiter({ limit: 5, windowMs: 0 })).toThrow();
  });
});
