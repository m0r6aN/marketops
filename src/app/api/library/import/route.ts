/**
 * POST /api/library/import
 *
 * Accepts multipart form upload with one or more files plus processing options.
 * Creates an import batch, source documents, extracts text, and runs the
 * LLM processing pipeline for each file.
 */
import { enqueueImportBatch } from "@/lib/library/import-worker";
import {
  detectSensitiveFilename,
  extractText,
  hashContent,
} from "@/lib/library/parser";
import {
  createImportBatch,
  createSourceDocument,
  updateImportBatch,
  updateSourceDocument,
} from "@/lib/library/repository";
import type { ImportFileMetadata, ModelStrategy, ProcessingMode } from "@/lib/library/types";
import { NextRequest, NextResponse } from "next/server";

function normalizeClientRelativePath(path: string | null | undefined, fileName: string): string | null {
  if (!path) return null;
  const normalized = path.trim().replace(/\\+/g, "/").replace(/^\.\//, "");
  if (!normalized || normalized === fileName) return null;
  return normalized;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // ── Parse modes and strategy ──────────────────────────────────────────
    const rawModes = formData.get("modes");
    const rawStrategy = formData.get("modelStrategy");
    const rawUseOllama = formData.get("useOllama");
    const rawUseBlackbox = formData.get("useBlackbox");

    let modes: ProcessingMode[] = ["canon", "marketing", "internal", "trash"];
    if (typeof rawModes === "string") {
      try {
        const parsed = JSON.parse(rawModes);
        if (Array.isArray(parsed)) modes = parsed as ProcessingMode[];
      } catch {
        // Use defaults
      }
    }

    const modelStrategy: ModelStrategy =
      rawStrategy === "sonnet-only" ? "sonnet-only" : "auto";

    const useOllama =
      typeof rawUseOllama === "string" && rawUseOllama.toLowerCase() === "true";
    const useBlackbox =
      typeof rawUseBlackbox === "string" && rawUseBlackbox.toLowerCase() === "true";

    const rawInitiativeSlug = formData.get("initiativeSlug");
    const initiativeSlug =
      typeof rawInitiativeSlug === "string" && rawInitiativeSlug.trim().length > 0
        ? rawInitiativeSlug.trim()
        : null;

    const rawFileMetadata = formData.get("fileMetadata");
    let fileMetadata: ImportFileMetadata[] = [];
    if (typeof rawFileMetadata === "string") {
      try {
        const parsed = JSON.parse(rawFileMetadata);
        if (Array.isArray(parsed)) {
          fileMetadata = parsed.filter(
            (item): item is ImportFileMetadata =>
              typeof item === "object" &&
              item !== null &&
              typeof item.name === "string" &&
              typeof item.size === "number" &&
              typeof item.lastModified === "number" &&
              (typeof item.relativePath === "string" || item.relativePath === null)
          );
        }
      } catch {
        // Ignore malformed client metadata.
      }
    }

    // ── Collect uploaded files ────────────────────────────────────────────
    const files: File[] = [];
    for (const [, value] of formData.entries()) {
      if (value instanceof File && value.size > 0) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files uploaded" },
        { status: 400 }
      );
    }

    // ── Sensitive-file check ──────────────────────────────────────────────
    const sensitiveFiles = files
      .filter((f) => detectSensitiveFilename(f.name))
      .map((f) => f.name);

    const confirmSensitive = request.nextUrl.searchParams.get("confirmSensitive") === "true";
    if (sensitiveFiles.length > 0 && !confirmSensitive) {
      return NextResponse.json(
        {
          error: "Sensitive files detected",
          sensitiveFiles,
          message:
            "One or more files appear to contain secrets. Add ?confirmSensitive=true to proceed anyway.",
        },
        { status: 422 }
      );
    }

    // ── File size guard (10 MB per file) ─────────────────────────────────
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    const oversizedFiles = files
      .filter((f) => f.size > MAX_FILE_SIZE)
      .map((f) => f.name);

    if (oversizedFiles.length > 0) {
      return NextResponse.json(
        {
          error: "Files too large",
          oversizedFiles,
          message: "Each file must be under 10 MB.",
        },
        { status: 413 }
      );
    }

    // ── Create import batch ───────────────────────────────────────────────
    const batch = createImportBatch({ selectedModes: modes, modelStrategy, initiativeSlug });
    updateImportBatch(batch.id, {
      status: "processing",
      totalFiles: files.length,
      startedAt: new Date().toISOString(),
    });

    // ── Parse and persist each file before background processing ──────────
    let failedFiles = 0;

    for (const [index, file] of files.entries()) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const contentHash = hashContent(buffer.toString("utf-8").slice(0, 10_000));
      const metadata = fileMetadata[index];

      // Create source document record
      const doc = createSourceDocument({
        importBatchId: batch.id,
        originalFilename: file.name,
        clientRelativePath: normalizeClientRelativePath(metadata?.relativePath, file.name),
        mimeType: file.type || undefined,
        fileSize: file.size,
        contentHash,
      });

      // Extract text
      const extracted = await extractText(file.name, buffer);

      if (extracted.status === "failed") {
        failedFiles++;
        updateSourceDocument(doc.id, {
          parserStatus: "failed",
          processingStatus: "failed",
          errorMessage: extracted.error,
        });
        continue;
      }

      // Save raw text
      updateSourceDocument(doc.id, {
        rawText: extracted.text,
        parserStatus: "processed",
        contentHash: hashContent(extracted.text),
      });
    }

    const providerLabel = useOllama ? "Ollama" : useBlackbox ? "Blackbox" : "Claude";
    updateImportBatch(batch.id, {
      status: "processing",
      failedFiles,
      summary: `Queued ${files.length} file(s) for ${providerLabel} processing.`,
    });

    enqueueImportBatch({ batchId: batch.id, modes, initiativeSlug, useOllama, useBlackbox });

    return NextResponse.json({
      batchId: batch.id,
      status: "processing",
      totalFiles: files.length,
      processedFiles: 0,
      failedFiles,
      entriesExtracted: 0,
      trashCandidates: 0,
      conflictsDetected: 0,
    });
  } catch (err) {
    console.error("[Library Import]", err);
    return NextResponse.json(
      {
        error: "Import failed",
        message: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
