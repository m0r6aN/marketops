/**
 * Library Canon Foundry — service layer.
 *
 * Business logic, aggregation, and public-safety enforcement.
 * Callers (pages, API routes, server actions) should use this layer,
 * not the repository directly, when business rules apply.
 */
import {
    getImportBatch,
    getLatestMarketingReviewSummary,
    getLibraryCounts,
    getLibraryEntry,
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
