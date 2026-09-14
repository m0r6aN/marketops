/**
 * k1-context-conformance — Context Fabric conformance harness.
 *
 * Context Fabric doctrine (advisory-only context, provenance-bound units,
 * tenant-scoped retrieval incl. cache keys, deterministic assembly,
 * fail-closed on unverifiable, never a receipt substitute).
 *
 * This module is PURE: no I/O, no DB, no network, no new dependencies.
 * It proves that MarketOps library/canon context assembly can meet the
 * doctrine WITHOUT redesigning assembly — provenance is attached at bundle
 * boundaries, and the bundle is marked advisory-only at the TYPE level.
 *
 * Advisory-only marking lives on the type (`readonly advisoryOnly: true`),
 * not on a receipt/authorization-shaped field. The following vocabulary MUST
 * NEVER appear as fields on ProvenanceUnit/ContextBundle (enforced by test):
 * decision, authorization/authorized, receipt/receiptRef, verdict, approved,
 * allowed/denied, policyDecision/policyHash, denialCode, signature, epoch.
 *
 * Library/canon provenance mapping (see src/lib/library/*):
 * - Units are built in repository.createLibraryEntry (via processor
 *   createCanonCandidate/createMarketingCandidate/createInternalCandidate and
 *   marketing-review-writer.persistMarketingReview).
 * - Provenance carried today per entry: sourceDocumentId, importBatchId,
 *   initiativeSlug, sourceQuote, sourceLocation ("chunk N of M") or
 *   sourceSection/sourceExcerpt, modelUsed, createdAt/updatedAt; ingest-level
 *   contentHash lives on SourceDocument (parser.hashContent, bare hex).
 * - NOT carried today per entry: per-unit contentHash (sha256:), retrievedAtUtc,
 *   tenantId (legacy sqlite rows carry no tenant column; scoping is via
 *   initiativeSlug + isRowVisibleToTenant predicate + route-level session
 *   filter), actorId (only reviewedBy on human review).
 * - Retrieval/assembly boundaries: listLibraryEntries, listApprovedCanon,
 *   listPublicAutomationApproved/service.getAutomationApprovedEntries,
 *   service.getCanonView, searchLibraryEntries, brand-voice
 *   listEligibleBrandVoiceLibrarySources (initiativeSlug + status filter).
 * - Caching: NO in-memory/dedicated cache exists on library assembly paths
 *   today (only Next revalidatePath). buildLibraryContextCacheKey defines the
 *   REQUIRED tenant-scoped key shape any future cache must use.
 */

import { createHash, randomUUID } from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Required content-hash prefix. Bare hex is never accepted. */
export const CONTEXT_HASH_PREFIX = "sha256:" as const;

/** Human-readable advisory label. Informational only; enforcement is type-level. */
export const CONTEXT_ADVISORY_NOTE =
  "Advisory context only — never a receipt, authorization, or decision." as const;

/** Version infix for tenant-scoped cache keys. Bump only with key-shape change. */
export const CONTEXT_CACHE_KEY_VERSION = "v1" as const;

// ─────────────────────────────────────────────────────────────────────────────
// Types (advisory-only marking at TYPE level)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single provenance-bound context unit.
 * Advisory evidence only: carries NO execution permission, NO decision, NO
 * receipt. Fail-closed: any unit missing these fields is excluded, never
 * defaulted.
 */
export type ProvenanceUnit = {
  /** Stable source identity (e.g. library entry id). */
  sourceId: string;
  /** sha256:<hex> over the advisory excerpt. Bare hex rejected. */
  contentHash: string;
  /** ISO-8601 UTC timestamp of retrieval/binding. */
  retrievedAtUtc: string;
  /** Canonical tenant key. Cross-tenant units are rejected, never merged. */
  tenantId: string;
  /** Who retrieved/bound the unit (user:{guid} or system:{component}). */
  actorId?: string;
  // ── Advisory payload (context, never authority) ──
  /** Entry kind (e.g. canon | marketing_nugget | internal_note). */
  kind: string;
  /** Short label for display/dedup. */
  title: string;
  /** Advisory excerpt (canonical statement / copy / content slice). */
  excerpt: string;
  /** Initiative scope the unit was retrieved under (null when unscoped). */
  initiativeSlug?: string | null;
};

/**
 * A deterministically assembled, tenant-scoped bundle of advisory units.
 * `advisoryOnly: true` is a TYPE-level marker — it carries no receipt or
 * authorization semantics and must never be mistaken for one.
 */
export type ContextBundle = {
  readonly advisoryOnly: true;
  bundleId: string;
  correlationId: string;
  tenantId: string;
  assembledAtUtc: string;
  units: readonly ProvenanceUnit[];
  /** Deterministic sha256:<hex> over (tenantId, correlationId, sorted units). */
  fingerprint: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Errors (fail-closed)
// ─────────────────────────────────────────────────────────────────────────────

export class CrossTenantContextError extends Error {
  readonly rejectedSourceIds: string[];
  constructor(expectedTenantId: string, rejectedSourceIds: string[]) {
    super(
      `Cross-tenant context rejected for tenant "${expectedTenantId}": ` +
        `${rejectedSourceIds.length} unit(s) [${rejectedSourceIds.join(", ")}].`,
    );
    this.name = "CrossTenantContextError";
    this.rejectedSourceIds = rejectedSourceIds;
  }
}

export class InvalidContextInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidContextInputError";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Primitive guards
// ─────────────────────────────────────────────────────────────────────────────

/** True when value is `sha256:` + 64 lowercase/uppercase hex chars. */
export function isSha256Hash(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length === CONTEXT_HASH_PREFIX.length + 64 &&
    value.startsWith(CONTEXT_HASH_PREFIX) &&
    /^[0-9a-fA-F]{64}$/.test(value.slice(CONTEXT_HASH_PREFIX.length))
  );
}

/** True when value parses as a valid ISO-8601 date. */
export function isIsoUtc(value: unknown): value is string {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Type guard: true only when a candidate carries complete, well-formed
 * provenance (sourceId, sha256: contentHash, ISO retrievedAtUtc, tenantId).
 * Advisory payload (kind/title/excerpt) must also be present so units are
 * never bare pointers.
 */
export function isProvenanceComplete(unit: unknown): unit is ProvenanceUnit {
  if (typeof unit !== "object" || unit === null) return false;
  const u = unit as Record<string, unknown>;
  return (
    isNonEmptyString(u.sourceId) &&
    isSha256Hash(u.contentHash) &&
    isIsoUtc(u.retrievedAtUtc) &&
    isNonEmptyString(u.tenantId) &&
    (u.actorId === undefined || isNonEmptyString(u.actorId)) &&
    isNonEmptyString(u.kind) &&
    isNonEmptyString(u.title) &&
    typeof u.excerpt === "string" &&
    u.excerpt.length > 0
  );
}

/**
 * Fail-closed provenance gate: returns ONLY verifiable units, silently
 * excluding anything unprovenanced/unverifiable (null, partial, bad hash,
 * bad timestamp). Never defaults missing fields — exclusion IS the
 * fail-closed behavior. Empty result is valid (callers get no context,
 * never bad context).
 */
export function requireProvenance(
  candidates: readonly unknown[],
): ProvenanceUnit[] {
  return candidates.filter(isProvenanceComplete);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tenant scoping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fail-closed tenant gate: returns units when EVERY unit belongs to
 * expectedTenantId, otherwise throws CrossTenantContextError (no partial
 * cross-tenant bundle is ever returned).
 */
export function tenantScopeCheck(
  units: readonly ProvenanceUnit[],
  expectedTenantId: string,
): ProvenanceUnit[] {
  if (!isNonEmptyString(expectedTenantId)) {
    throw new InvalidContextInputError("tenantScopeCheck requires a tenantId.");
  }
  const rejected = units
    .filter((u) => u.tenantId !== expectedTenantId)
    .map((u) => u.sourceId);
  if (rejected.length > 0) {
    throw new CrossTenantContextError(expectedTenantId, rejected);
  }
  return [...units];
}

// ─────────────────────────────────────────────────────────────────────────────
// Hashing + fingerprint (deterministic assembly)
// ─────────────────────────────────────────────────────────────────────────────

/** sha256:<hex> over UTF-8 bytes of content (no normalization surprises). */
export function hashAdvisoryContent(content: string): string {
  return (
    CONTEXT_HASH_PREFIX +
    createHash("sha256").update(content, "utf-8").digest("hex")
  );
}

/**
 * True when unit.contentHash exactly matches hashAdvisoryContent(content).
 * False = hash mismatch (flagged, never auto-corrected).
 */
export function verifyUnitContentHash(
  unit: ProvenanceUnit,
  content: string,
): boolean {
  return unit.contentHash === hashAdvisoryContent(content);
}

/** Returns the subset of units whose bound content no longer matches. */
export function collectHashMismatches(
  entries: ReadonlyArray<{ unit: ProvenanceUnit; content: string }>,
): ProvenanceUnit[] {
  return entries
    .filter(({ unit, content }) => !verifyUnitContentHash(unit, content))
    .map(({ unit }) => unit);
}

type FingerprintUnit = Pick<
  ProvenanceUnit,
  | "sourceId"
  | "contentHash"
  | "tenantId"
  | "kind"
  | "title"
  | "excerpt"
  | "initiativeSlug"
  | "actorId"
>;

function canonicalUnit(u: ProvenanceUnit): FingerprintUnit {
  return {
    sourceId: u.sourceId,
    contentHash: u.contentHash,
    tenantId: u.tenantId,
    kind: u.kind,
    title: u.title,
    excerpt: u.excerpt,
    initiativeSlug: u.initiativeSlug ?? null,
    actorId: u.actorId,
  };
}

function compareUnits(a: ProvenanceUnit, b: ProvenanceUnit): number {
  if (a.sourceId !== b.sourceId) return a.sourceId < b.sourceId ? -1 : 1;
  if (a.contentHash !== b.contentHash)
    return a.contentHash < b.contentHash ? -1 : 1;
  if (a.tenantId !== b.tenantId) return a.tenantId < b.tenantId ? -1 : 1;
  return 0;
}

/**
 * Deterministic bundle fingerprint: sha256:<hex> over canonical JSON of
 * (tenantId, correlationId, units sorted by sourceId/contentHash/tenantId).
 * Identical logical inputs → identical fingerprint regardless of input order.
 * Any byte difference (unit added/removed/edited, tenant/correlation change)
 * → different fingerprint.
 */
export function fingerprintContextUnits(
  units: readonly ProvenanceUnit[],
  tenantId: string,
  correlationId: string,
): string {
  if (!isNonEmptyString(tenantId)) {
    throw new InvalidContextInputError(
      "fingerprintContextUnits requires a tenantId.",
    );
  }
  if (!isNonEmptyString(correlationId)) {
    throw new InvalidContextInputError(
      "fingerprintContextUnits requires a correlationId.",
    );
  }
  const sorted = [...units].sort(compareUnits).map(canonicalUnit);
  const canonical = JSON.stringify({
    tenantId,
    correlationId,
    units: sorted,
  });
  return (
    CONTEXT_HASH_PREFIX +
    createHash("sha256").update(canonical, "utf-8").digest("hex")
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tenant-scoped cache keys
// ─────────────────────────────────────────────────────────────────────────────

/**
 * REQUIRED key shape for any future library-context cache:
 * `library-context:v1:tenant:<tenantId>:scope:<scope>[:corr:<correlationId>]`
 *
 * Tenant is a mandatory infix so keys can NEVER collide across tenants.
 * No cache exists on library assembly paths today (verified: no in-memory
 * or dedicated cache in src/lib/library/*; only Next revalidatePath) — this
 * helper exists so conformance can prove the scoping rule BEFORE a cache
 * is introduced.
 */
export function buildLibraryContextCacheKey(
  tenantId: string,
  scope: string,
  correlationId?: string,
): string {
  if (!isNonEmptyString(tenantId)) {
    throw new InvalidContextInputError(
      "buildLibraryContextCacheKey requires a tenantId.",
    );
  }
  if (!isNonEmptyString(scope)) {
    throw new InvalidContextInputError(
      "buildLibraryContextCacheKey requires a scope.",
    );
  }
  const base =
    `library-context:${CONTEXT_CACHE_KEY_VERSION}` +
    `:tenant:${tenantId.trim()}:scope:${scope.trim()}`;
  if (correlationId !== undefined) {
    if (!isNonEmptyString(correlationId)) {
      throw new InvalidContextInputError(
        "buildLibraryContextCacheKey requires a non-empty correlationId when provided.",
      );
    }
    return `${base}:corr:${correlationId.trim()}`;
  }
  return base;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bundle assembly (fail-closed, deterministic, advisory-only)
// ─────────────────────────────────────────────────────────────────────────────

export type AssembleContextBundleInput = {
  /** Mixed candidates; unverifiable entries are EXCLUDED (fail-closed). */
  candidates: readonly unknown[];
  tenantId: string;
  correlationId: string;
  bundleId?: string;
  assembledAtUtc?: string;
};

/**
 * Assemble an advisory-only ContextBundle:
 * 1. requireProvenance (exclude unverifiable),
 * 2. tenantScopeCheck (throw on cross-tenant — no partial leak),
 * 3. deterministic sort + fingerprint,
 * 4. return bundle with `advisoryOnly: true` (type-level marker).
 */
export function assembleContextBundle(
  input: AssembleContextBundleInput,
): ContextBundle {
  if (!isNonEmptyString(input.tenantId)) {
    throw new InvalidContextInputError(
      "assembleContextBundle requires a tenantId.",
    );
  }
  if (!isNonEmptyString(input.correlationId)) {
    throw new InvalidContextInputError(
      "assembleContextBundle requires a correlationId.",
    );
  }
  const tenantId = input.tenantId.trim();
  const correlationId = input.correlationId.trim();

  const verified = requireProvenance(input.candidates);
  tenantScopeCheck(verified, tenantId);

  const sorted = [...verified].sort(compareUnits);
  const fingerprint = fingerprintContextUnits(sorted, tenantId, correlationId);

  return {
    advisoryOnly: true as const,
    bundleId: input.bundleId ?? randomUUID(),
    correlationId,
    tenantId,
    assembledAtUtc: input.assembledAtUtc ?? new Date().toISOString(),
    units: sorted,
    fingerprint,
  };
}
