/**
 * GET /api/library/import/[id]
 *
 * Returns batch status, counts, and the list of source documents.
 * Used by the import progress component to poll for completion.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getImportBatch,
  listSourceDocumentsByBatch,
} from "@/lib/library/repository";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const batch = getImportBatch(id);
  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  const documents = listSourceDocumentsByBatch(id);

  return NextResponse.json({ batch, documents });
}
