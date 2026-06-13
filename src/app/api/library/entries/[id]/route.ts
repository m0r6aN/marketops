/**
 * GET /api/library/entries/[id]   — single entry detail
 * PATCH /api/library/entries/[id] — partial update
 */
import { NextRequest, NextResponse } from "next/server";
import { getLibraryEntry, updateLibraryEntry } from "@/lib/library/repository";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const entry = getLibraryEntry(id);
  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }
  return NextResponse.json({ entry });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const entry = getLibraryEntry(id);
  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
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
