/**
 * GET /api/library/entries
 *
 * List library entries with optional filters via query params.
 */
import { NextRequest, NextResponse } from "next/server";
import { listLibraryEntries } from "@/lib/library/repository";
import type { LibraryEntryFilters, EntryType, EntryStatus, EntryVisibility } from "@/lib/library/types";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const filters: LibraryEntryFilters = {};

  const entryType = sp.get("entryType");
  if (entryType) filters.entryType = entryType as EntryType;

  const status = sp.get("status");
  if (status) filters.status = status as EntryStatus;

  const visibility = sp.get("visibility");
  if (visibility) filters.visibility = visibility as EntryVisibility;

  const publicSafe = sp.get("publicSafe");
  if (publicSafe !== null) filters.publicSafe = publicSafe === "true";

  const sensitive = sp.get("sensitive");
  if (sensitive !== null) filters.sensitive = sensitive === "true";

  const importBatchId = sp.get("importBatchId");
  if (importBatchId) filters.importBatchId = importBatchId;

  const sourceDocumentId = sp.get("sourceDocumentId");
  if (sourceDocumentId) filters.sourceDocumentId = sourceDocumentId;

  const searchQuery = sp.get("q");
  if (searchQuery) filters.searchQuery = searchQuery;

  const minConfidence = sp.get("minConfidence");
  if (minConfidence) filters.minConfidence = parseFloat(minConfidence);

  const minMemoryValue = sp.get("minMemoryValue");
  if (minMemoryValue) filters.minMemoryValue = parseFloat(minMemoryValue);

  const entries = listLibraryEntries(filters);
  return NextResponse.json({ entries, count: entries.length });
}
