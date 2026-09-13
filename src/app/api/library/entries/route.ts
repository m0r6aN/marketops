/**
 * GET /api/library/entries
 *
 * List library entries with optional filters via query params.
 */
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { isRowVisibleToTenant, listLibraryEntries } from "@/lib/library/repository";
import type { LibraryEntryFilters, EntryType, EntryStatus, EntryVisibility } from "@/lib/library/types";

export async function GET(request: NextRequest) {
  // w2-tenant-wire: session gate + per-record tenant wiring. No session =>
  // 401; the list is scoped to rows visible to the session tenant (legacy
  // sqlite rows without a tenant column stay visible locally; PG rows are
  // RLS- plus predicate-scoped). No path relies on session-presence alone.
  const session = verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null);
  if (!session) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        denialCode: "UNAUTHENTICATED",
        denialMessage: "Library entries denied: no authenticated tenant session.",
        failureStage: "decision",
      },
      { status: 401 },
    );
  }

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

  const entries = listLibraryEntries(filters).filter((entry) =>
    isRowVisibleToTenant(session.tenantId, entry),
  );
  return NextResponse.json({ entries, count: entries.length });
}
