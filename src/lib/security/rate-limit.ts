/**
 * rp-02-headers-ratelimit — Edge-safe fixed-window rate limiter.
 *
 * Edge-safe by design: no imports, no Node.js APIs, no timers. State lives
 * in a module-scope `Map`; each isolate gets its own bucket set, which is
 * correct for local/dev and a documented best-effort (not a distributed
 * guarantee) in multi-instance deployments.
 *
 * Failure posture: pure total functions — `check` never throws for runtime
 * input. Misconfiguration (`limit <= 0`, `windowMs <= 0`) throws at
 * construction (fail-fast during startup, never per-request).
 */

export interface RateLimitDecision {
  allowed: boolean;
  /** Requests remaining in the current window (0 when denied). */
  remaining: number;
  /** Milliseconds until the current window resets (>= 0). */
  resetMs: number;
}

export interface RateLimiter {
  check(key: string, nowMs?: number): RateLimitDecision;
}

export function createRateLimiter(opts: { limit: number; windowMs: number }): RateLimiter {
  const { limit, windowMs } = opts;
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("createRateLimiter: limit must be a positive integer.");
  }
  if (!Number.isInteger(windowMs) || windowMs <= 0) {
    throw new Error("createRateLimiter: windowMs must be a positive integer.");
  }
  const buckets = new Map<string, { count: number; windowStart: number }>();
  return {
    check(rawKey: string, nowMs?: number): RateLimitDecision {
      const key = typeof rawKey === "string" && rawKey.length > 0 ? rawKey : "unknown";
      const now = typeof nowMs === "number" && Number.isFinite(nowMs) ? nowMs : Date.now();
      const slot = buckets.get(key);
      if (!slot || now - slot.windowStart >= windowMs) {
        buckets.set(key, { count: 1, windowStart: now });
        return { allowed: true, remaining: limit - 1, resetMs: windowMs };
      }
      if (slot.count < limit) {
        slot.count += 1;
        return { allowed: true, remaining: limit - slot.count, resetMs: slot.windowStart + windowMs - now };
      }
      return { allowed: false, remaining: 0, resetMs: slot.windowStart + windowMs - now };
    },
  };
}
