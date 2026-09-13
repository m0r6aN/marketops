/**
 * GET /api/library/import/[id]
 *
 * Returns batch status, counts, and the list of source documents.
 * Used by the import progress component to poll for completion.
 */
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, TenantScopeError, verifySessionToken } from "@/lib/auth/session";
import {
  getImportBatch,
  isRowVisibleToTenant,
  listSourceDocumentsByBatch,
  requireRowTenantMatch,
} from "@/lib/library/repository";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // w2-tenant-wire: session gate + per-record tenant wiring. No session =>
  // 401; batch owned by another tenant => 403 (no path relies on
  // session-presence alone).
  const session = verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null);
  if (!session) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        denialCode: "UNAUTHENTICATED",
        denialMessage: "Import status denied: no authenticated tenant session.",
        failureStage: "decision",
      },
      { status: 401 },
    );
  }

  const { id } = await params;

  const batch = getImportBatch(id);
  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }
  try {
    requireRowTenantMatch(session.tenantId, batch, "library import status");
  } catch (error) {
    if (error instanceof TenantScopeError) {
      return NextResponse.json(error.toResponseBody(), { status: error.httpStatus });
    }
    return NextResponse.json(
      {
        error: "Forbidden",
        denialCode: "TENANT_MISMATCH",
        denialMessage: "Import status denied: tenant mismatch.",
        failureStage: "decision",
      },
      { status: 403 },
    );
  }

  const documents = listSourceDocumentsByBatch(id).filter((doc) =>
    isRowVisibleToTenant(session.tenantId, doc),
  );

  return NextResponse.json({ batch, documents });
}
