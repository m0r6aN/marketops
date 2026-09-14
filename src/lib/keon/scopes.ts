// ---------------------------------------------------------------------------
// Keon gateway scopes (k1-gateway-client, S8).
// Scope constants + pre-transport guard. No transport, no network, no
// secrets. Casing: domain constants are camelCase identifiers with
// colon-namespaced values; no snake_case wire keys here.
// ---------------------------------------------------------------------------

/** Base scope: required for every gateway tool call. */
export const KEON_SCOPE_MCP_INVOKE = "keon:mcp:invoke" as const;

/** Per-tool scope: required for the BrowseAhead scan tool. */
export const KEON_SCOPE_BROWSE_AHEAD_SCAN = "keon:browseahead:scan" as const;

/** Known scopes issued to gateway callers. */
export const KEON_KNOWN_SCOPES = [
  KEON_SCOPE_MCP_INVOKE,
  KEON_SCOPE_BROWSE_AHEAD_SCAN,
] as const;

export type KeonScope = (typeof KEON_KNOWN_SCOPES)[number];

/** Governed pre-transport error: required scope(s) were not granted. */
export class KeonScopeError extends Error {
  readonly code = "KEON_MISSING_SCOPE" as const;
  readonly missing: readonly string[];

  constructor(missing: readonly string[]) {
    super(`KEON_MISSING_SCOPE: missing required scope(s): ${missing.join(", ")}`);
    this.name = "KeonScopeError";
    this.missing = [...missing];
  }
}

/**
 * Fail-closed guard: throw KeonScopeError before any transport call when a
 * required scope is not in the granted set. Never returns a fake success.
 */
export function requireScopes(
  granted: readonly string[] | null | undefined,
  required: readonly string[]
): void {
  const have = new Set<string>(granted ?? []);
  const missing = required.filter((scope) => !have.has(scope));
  if (missing.length > 0) {
    throw new KeonScopeError(missing);
  }
}
