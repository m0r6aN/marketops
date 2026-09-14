/**
 * Library Canon Foundry — service layer.
 *
 * Business logic, aggregation, and public-safety enforcement.
 * Callers (pages, API routes, server actions) should use this layer,
 * not the repository directly, when business rules apply.
 */
import {
  assembleContextBundle,
  buildLibraryContextCacheKey,
  hashAdvisoryContent,
  type ContextBundle,
  type ProvenanceUnit,
} from "@/lib/keon/context";
import {
    getImportBatch,
    getLatestMarketingReviewSummary,
    getLibraryCounts,
    getLibraryEntry,
    isRowVisibleToTenant,
    listImportBatches,
    listLibraryEntries,
    listMarketingAssetOpportunitiesByDocument,
    listMarketingRedFlagsByDocument,
    listMarketingReviewSummariesByDocument,
    listOpenMarketingAssetOpportunities,
    listPublicAutomationApproved,
    listReviewQueue,
    listSourceDocumentsByBatch,
    listTrashRecords,
    listUnresolvedConflicts,
    listUnresolvedMarketingRedFlags,
    updateLibraryEntry,
} from "@/lib/library/repository";
import type {
    ConflictRecord,
    ImportBatch,
    LibraryEntry,
    LibraryEntryFilters,
    LibrarySectionCounts,
    MarketingAssetOpportunity,
    MarketingRedFlag,
    MarketingReviewSummary,
    PublicSafetyCheckResult,
    SourceDocument,
    TrashRecord,
} from "@/lib/library/types";

// ─────────────────────────────────────────────────────────────────────────────
// Section counts (nav badges)
// ─────────────────────────────────────────────────────────────────────────────

export function getLibrarySectionCounts(): LibrarySectionCounts {
  return getLibraryCounts();
}

// ─────────────────────────────────────────────────────────────────────────────
// Review queue
// ─────────────────────────────────────────────────────────────────────────────

export type ReviewQueueItem = LibraryEntry & {
  hasConflict: boolean;
};

export function getReviewQueueSummary(): ReviewQueueItem[] {
  const entries = listReviewQueue();
  const conflicts = listUnresolvedConflicts();
  const conflictedEntryIds = new Set<string>(
    conflicts.flatMap((c) => [c.existingEntryId, c.challengerEntryId])
  );

  return entries.map((entry) => ({
    ...entry,
    hasConflict: conflictedEntryIds.has(entry.id),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Section views
// ─────────────────────────────────────────────────────────────────────────────

export function getCanonView(
  filters: Omit<LibraryEntryFilters, "entryType"> = {}
): LibraryEntry[] {
  return listLibraryEntries({ ...filters, entryType: "canon" });
}

export function getMarketingGoldView(
  filters: Omit<LibraryEntryFilters, "entryType"> = {}
): LibraryEntry[] {
  return listLibraryEntries({ ...filters, entryType: "marketing_nugget" });
}

export function getInternalDocsView(
  filters: Omit<LibraryEntryFilters, "entryType"> = {}
): LibraryEntry[] {
  return listLibraryEntries({ ...filters, entryType: "internal_note" });
}

export function getConflictsView(): ConflictRecord[] {
  return listUnresolvedConflicts();
}

export function getTrashView(): TrashRecord[] {
  return listTrashRecords();
}

export function getImportsView(): ImportBatch[] {
  return listImportBatches();
}

export function getImportDetailView(id: string): {
  batch: ImportBatch;
  documents: SourceDocument[];
} | null {
  const batch = getImportBatch(id);
  if (!batch) return null;

  return {
    batch,
    documents: listSourceDocumentsByBatch(id),
  };
}

// ── Docs-as-marketing review views ───────────────────────────────────────────

export function getRedFlagsView(): MarketingRedFlag[] {
  return listUnresolvedMarketingRedFlags();
}

export function getAssetOpportunitiesView(): MarketingAssetOpportunity[] {
  return listOpenMarketingAssetOpportunities();
}

/** All marketing-review artifacts for a single source document. */
export function getMarketingReviewForDocument(sourceDocumentId: string): {
  latestSummary: MarketingReviewSummary | null;
  summaries: MarketingReviewSummary[];
  redFlags: MarketingRedFlag[];
  assetOpportunities: MarketingAssetOpportunity[];
} {
  return {
    latestSummary: getLatestMarketingReviewSummary(sourceDocumentId),
    summaries: listMarketingReviewSummariesByDocument(sourceDocumentId),
    redFlags: listMarketingRedFlagsByDocument(sourceDocumentId),
    assetOpportunities:
      listMarketingAssetOpportunitiesByDocument(sourceDocumentId),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public safety gates (spec §7)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks all 8 public-safety conditions required before an entry may be used
 * in automated marketing.  Returns the result and a list of failed conditions.
 */
export function checkPublicSafetyGates(
  entryId: string
): PublicSafetyCheckResult {
  const entry = getLibraryEntry(entryId);
  if (!entry) {
    return {
      safe: false,
      failedConditions: ["Entry not found"],
    };
  }

  const failedConditions: string[] = [];

  if (entry.visibility !== "public") {
    failedConditions.push("visibility must be 'public'");
  }
  if (!entry.publicSafe) {
    failedConditions.push("public_safe must be true");
  }
  if (entry.status !== "approved" && entry.status !== "locked") {
    failedConditions.push("status must be 'approved' or 'locked'");
  }
  if (entry.sensitive) {
    failedConditions.push("sensitive must be false");
  }
  if (!entry.approvedForAutomation) {
    failedConditions.push("approved_for_automation must be true");
  }
  if (
    entry.conflictStatus !== null &&
    entry.conflictStatus !== "resolved"
  ) {
    failedConditions.push("all conflicts must be resolved");
  }
  if (entry.entryType === "internal_note") {
    failedConditions.push("internal_note entries cannot be used for automation");
  }
  if (entry.locked && entry.status === "deprecated") {
    failedConditions.push("deprecated entries cannot be used for automation");
  }

  return {
    safe: failedConditions.length === 0,
    failedConditions,
  };
}

/**
 * Returns all entries that pass every public-safety gate.
 * This is the source of truth for marketing automation consumers.
 */
export function getAutomationApprovedEntries(): LibraryEntry[] {
  return listPublicAutomationApproved();
}

// ─────────────────────────────────────────────────────────────────────────────
// Promotion safeguard (internal → public candidate)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Marks an internal entry as a public promotion candidate.
 * Does NOT change visibility or public_safe — those require a strong-model
 * safety review (performed in the server action / AI pipeline) plus explicit
 * human approval.
 *
 * Returns the updated entry so the caller can pass it to the safety reviewer.
 */
export function flagForPublicPromotion(entryId: string): LibraryEntry {
  const entry = getLibraryEntry(entryId);
  if (!entry) throw new Error(`Entry ${entryId} not found`);
  if (entry.entryType !== "internal_note") {
    throw new Error("Only internal_note entries can be promoted to public candidates");
  }
  // Mark as needs_review so it surfaces in the review queue
  updateLibraryEntry(entryId, { status: "needs_review" });
  return getLibraryEntry(entryId)!;
}

// ─────────────────────────────────────────────────────────────────────────────
// k1-context-conformance: advisory-only provenance attachment (bundle boundaries)
// ─────────────────────────────────────────────────────────────────────────────
//
// Context-Fabric conformance WITHOUT assembly redesign: existing retrieval
// (listLibraryEntries / listPublicAutomationApproved / getCanonView) is left
// untouched; provenance units + advisory marking are attached HERE at bundle
// boundaries via the pure keon/context harness.
//
// Provenance mapping (what entries carry today):
// - sourceDocumentId, importBatchId, initiativeSlug, sourceQuote,
//   sourceLocation ("chunk N of M"), modelUsed, createdAt/updatedAt;
//   ingest-level contentHash lives on SourceDocument (parser.hashContent).
// - Per-entry sha256: contentHash, retrievedAtUtc, tenantId, actorId are NOT
//   stored rows — they are BOUND HERE at retrieval: tenantId is the caller's
//   session tenant (rows predate tenant_id; isRowVisibleToTenant keeps legacy
//   rows visible locally and PG rows predicate-scoped), retrievedAtUtc is now,
//   contentHash binds the advisory excerpt, actorId mirrors reviewedBy when set.
// - No dedicated cache exists on library paths (only Next revalidatePath);
//   libraryContextCacheKey exposes the REQUIRED tenant-scoped shape for any
//   future cache. Retrieval itself is tenant-scoped via the tenantId param +
//   isRowVisibleToTenant filter before assembly (defense in depth: the harness
//   re-checks tenant inside assembleContextBundle and throws cross-tenant).
//
// Bundles are advisory context only (advisoryOnly: true at TYPE level) and
// must never be treated as authority: automation-approved entries pass the 8
// public-safety gates but carry NO claim verdict — persuasion-review
// decideClaimApply + content-workspace validation remain mandatory downstream.

/** Canonical advisory text bound by a unit (canon statement preferred). */
export function canonicalContentForLibraryEntry(entry: LibraryEntry): string {
  return (
    entry.canonicalStatement ??
    entry.copyText ??
    entry.content ??
    ""
  ).trim();
}

/**
 * Bind a single LibraryEntry to a provenance unit for the given tenant.
 * Pure + surgical: no schema change, no behavior change to existing callers.
 */
export function libraryEntryToProvenanceUnit(
  entry: LibraryEntry,
  tenantId: string,
  opts?: { retrievedAtUtc?: string; actorId?: string; contentHash?: string },
): ProvenanceUnit {
  if (!tenantId || !tenantId.trim()) {
    throw new Error("libraryEntryToProvenanceUnit requires a tenantId.");
  }
  const content = canonicalContentForLibraryEntry(entry);
  const excerpt = (content || entry.title).slice(0, 1_000);
  return {
    sourceId: entry.id,
    contentHash: opts?.contentHash ?? hashAdvisoryContent(content || entry.id),
    retrievedAtUtc: opts?.retrievedAtUtc ?? new Date().toISOString(),
    tenantId: tenantId.trim(),
    ...(opts?.actorId ?? entry.reviewedBy
      ? { actorId: (opts?.actorId ?? entry.reviewedBy) as string }
      : {}),
    kind: entry.entryType,
    title: entry.title,
    excerpt,
    initiativeSlug: entry.initiativeSlug ?? null,
  };
}

/** Tenant-scoped cache-key shape any future library-context cache must use. */
export function libraryContextCacheKey(
  tenantId: string,
  scope: string,
  correlationId?: string,
): string {
  return buildLibraryContextCacheKey(tenantId, scope, correlationId);
}

/**
 * Canon bundle boundary: approved/listed canon entries as advisory context.
 * Tenant-scoped (param + row-visibility filter), deterministically assembled,
 * fail-closed on unverifiable/cross-tenant units.
 */
export function getCanonContextBundle(
  tenantId: string,
  correlationId: string,
  filters: Omit<LibraryEntryFilters, "entryType"> = {},
): ContextBundle {
  const entries = getCanonView(filters).filter((entry) =>
    isRowVisibleToTenant(tenantId, entry),
  );
  return assembleContextBundle({
    candidates: entries.map((entry) =>
      libraryEntryToProvenanceUnit(entry, tenantId),
    ),
    tenantId,
    correlationId,
  });
}

/**
 * Automation-approved bundle boundary: public-safety-gated entries as
 * ADVISORY context (NOT an authorization — claim gates still apply downstream).
 */
export function getAutomationApprovedContextBundle(
  tenantId: string,
  correlationId: string,
): ContextBundle {
  const entries = getAutomationApprovedEntries().filter((entry) =>
    isRowVisibleToTenant(tenantId, entry),
  );
  return assembleContextBundle({
    candidates: entries.map((entry) =>
      libraryEntryToProvenanceUnit(entry, tenantId),
    ),
    tenantId,
    correlationId,
  });
}
