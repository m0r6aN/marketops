// ---------------------------------------------------------------------------
// Keon gateway correlation helper (k1-gateway-client, S8).
// Pure helpers only: no transport, no network, no secrets. Domain ids stay
// camelCase (correlationId); snake_case wire mapping lives only in
// src/lib/keon/client.ts (mapWireEnvelope), never here.
// ---------------------------------------------------------------------------

/**
 * Create a fresh correlation id for one gateway call. Thread it through
 * ctx.correlationId on callTool and every downstream receipt cites it
 * (PublishPacket.correlationId).
 *
 * Prefers crypto.randomUUID when available, otherwise falls back to a
 * 128-bit hex id from Math.random (stub-grade uniqueness; the gateway is
 * the authority on id collision, and the client always echoes).
 */
export function newCorrelationId(): string {
  const g = globalThis as unknown as {
    crypto?: { randomUUID?: () => string };
  };
  if (typeof g.crypto?.randomUUID === "function") {
    return g.crypto.randomUUID();
  }
  const hex = (): string => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
  return `${hex().slice(0, 8)}-${hex().slice(0, 4)}-4${hex().slice(1, 4)}-${hex().slice(0, 4)}-${hex()}${hex().slice(0, 4)}`;
}

/**
 * Return the caller-supplied id when it is a non-empty string, otherwise a
 * fresh id. The client uses this so an explicit ctx.correlationId is always
 * echoed, and a missing one is always generated (never empty).
 */
export function ensureCorrelationId(input: unknown): string {
  if (typeof input === "string" && input.trim().length > 0) {
    return input;
  }
  return newCorrelationId();
}

/** True iff value is a usable (non-empty string) correlation id. */
export function isCorrelationId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
