/**
 * GET /api/library/entries/[id]   — single entry detail
 * PATCH /api/library/entries/[id] — partial update
 */
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, TenantScopeError, verifySessionToken } from "@/lib/auth/session";
import { getLibraryEntry, requireRowTenantMatch, updateLibraryEntry } from "@/lib/library/repository";

function requireSession(request: NextRequest) {
  return verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null);
}

function unauthenticated() {
  return NextResponse.json(
    {
      error: "Unauthorized",
      denialCode: "UNAUTHENTICATED",
      denialMessage: "Library entry denied: no authenticated tenant session.",
      failureStage: "decision",
    },
    { status: 401 },
  );
}

function mismatch(fallbackMessage: string, error: unknown) {
  if (error instanceof TenantScopeError) {
    return NextResponse.json(error.toResponseBody(), { status: error.httpStatus });
  }
  return NextResponse.json(
    {
      error: "Forbidden",
      denialCode: "TENANT_MISMATCH",
      denialMessage: fallbackMessage,
      failureStage: "decision",
    },
    { status: 403 },
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // w2-tenant-wire: session gate + per-record tenant wiring (403 on mismatch).
  const session = requireSession(request);
  if (!session) return unauthenticated();
  const { id } = await params;
  const entry = getLibraryEntry(id);
  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }
  try {
    requireRowTenantMatch(session.tenantId, entry, "library entry read");
  } catch (error) {
    return mismatch("Library entry denied: tenant mismatch.", error);
  }
  return NextResponse.json({ entry });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // w2-tenant-wire: session gate + per-record tenant wiring (403 on mismatch).
  const session = requireSession(request);
  if (!session) return unauthenticated();
  const { id } = await params;
  const entry = getLibraryEntry(id);
  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }
  try {
    requireRowTenantMatch(session.tenantId, entry, "library entry write");
  } catch (error) {
    return mismatch("Library entry denied: tenant mismatch.", error);
  }

  let updates: Record<string, unknown>;
  try {
    updates = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Strip read-only fields from updates
  const { id: _id, sourceDocumentId: _src, importBatchId: _batch, createdAt: _ca, ...safe } = updates;
  void _id; void _src; void _batch; void _ca;

  updateLibraryEntry(id, safe as Parameters<typeof updateLibraryEntry>[1]);

  const updated = getLibraryEntry(id);
  return NextResponse.json({ entry: updated });
}
