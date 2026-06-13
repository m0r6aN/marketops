"use client";
import type { ImportBatch, LibraryLlmProvider, SourceDocument } from "@/lib/library/types";
import Link from "next/link";
import { useEffect, useState } from "react";

type ImportProgressProps = {
  batchId: string;
  llmProvider?: LibraryLlmProvider;
};

function getProviderLabel(
  provider: LibraryLlmProvider | undefined,
  summary: string | null | undefined
): string | null {
  if (provider === "ollama" || /with Ollama/i.test(summary ?? "")) return "Ollama";
  if (provider === "blackbox" || /with Blackbox/i.test(summary ?? "")) return "Blackbox";
  if (provider === "anthropic" || /with Claude/i.test(summary ?? "")) return "Claude";
  return null;
}

export function ImportProgress({ batchId, llmProvider }: ImportProgressProps) {
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [documents, setDocuments] = useState<SourceDocument[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;

    async function poll() {
      try {
        const res = await fetch(`/api/library/import/${batchId}`);
        if (!res.ok) throw new Error("Failed to fetch batch status");
        const data = await res.json();
        if (!stopped) {
          setBatch(data.batch);
          setDocuments(data.documents ?? []);
        }
        if (data.batch?.status === "processing" || data.batch?.status === "pending") {
          setTimeout(poll, 1500);
        }
      } catch (err) {
        if (!stopped) setError(err instanceof Error ? err.message : "Error polling status");
      }
    }

    poll();
    return () => { stopped = true; };
  }, [batchId]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="animate-pulse rounded-xl border border-border/60 p-4 text-sm text-muted-foreground">
        Starting import…
      </div>
    );
  }

  const isComplete = batch.status === "completed";
  const isFailed = batch.status === "failed";
  const isRunning = batch.status === "processing" || batch.status === "pending";
  const providerLabel = getProviderLabel(llmProvider, batch.summary);

  const completedFiles = batch.processedFiles + batch.failedFiles;
  const progress =
    batch.totalFiles > 0
      ? Math.round((completedFiles / batch.totalFiles) * 100)
      : 0;
  const extractionModesSelected = batch.selectedModes.some((mode) => mode !== "trash");

  function getDocumentStatus(doc: SourceDocument): string {
    if (doc.processingStatus === "failed" || doc.parserStatus === "failed") return "failed";
    if (doc.processingStatus === "processed") return "processed";
    if (doc.processingStatus === "processing") return "processing";
    if (doc.parserStatus === "processed") return "parsed";
    return "queued";
  }

  return (
    <div className="rounded-xl border border-border/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium">
          {isRunning && "Processing…"}
          {isComplete && "Import complete"}
          {isFailed && "Import failed"}
        </span>
        <div className="flex items-center gap-2">
          {providerLabel && (
            <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground">
              LLM: {providerLabel}
            </span>
          )}
          <span
            className={`text-xs font-medium ${
              isComplete
                ? "text-green-600"
                : isFailed
                ? "text-red-600"
                : "text-muted-foreground"
            }`}
          >
            {batch.status}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      {isRunning && (
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
            <span>{completedFiles} of {batch.totalFiles} files</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-foreground transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats */}
      {(isComplete || batch.entriesExtracted > 0) && (
        <div className="mb-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {[
            { label: "Entries extracted", value: batch.entriesExtracted },
            { label: "Trash candidates", value: batch.trashCandidates },
            { label: "Conflicts", value: batch.conflictsDetected },
            { label: "Failed files", value: batch.failedFiles },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-muted/50 p-2 text-center">
              <div className="text-lg font-semibold">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      )}

      {batch.summary && (
        <p className="mb-3 text-sm text-muted-foreground">{batch.summary}</p>
      )}

      {documents.length > 0 && (
        <div className="mb-3 rounded-lg border border-border/60 bg-muted/20 p-2.5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Imported documents</p>
            <p className="text-[11px] text-muted-foreground">Tracked in the import batch record</p>
          </div>
          <ul className="max-h-44 space-y-1.5 overflow-y-auto text-xs">
            {documents.map((doc) => {
              const displayPath = doc.clientRelativePath ?? doc.originalFilename;
              const status = getDocumentStatus(doc);
              return (
                <li key={doc.id} className="flex items-start justify-between gap-3 rounded-md bg-background/70 px-2 py-1.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{displayPath}</p>
                    {doc.clientRelativePath && (
                      <p className="truncate text-muted-foreground">file: {doc.originalFilename}</p>
                    )}
                    {doc.errorMessage && (
                      <p className="truncate text-red-600">{doc.errorMessage}</p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {status}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {isComplete && batch.entriesExtracted > 0 && (
        <Link
          href="/library/review"
          className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80"
        >
          Review {batch.entriesExtracted} extracted entries →
        </Link>
      )}

      {isComplete && batch.entriesExtracted === 0 && !extractionModesSelected && (
        <p className="text-sm text-muted-foreground">
          Trash scan complete. No extraction modes were selected, so no review entries were created.
        </p>
      )}

      {isComplete && batch.entriesExtracted === 0 && extractionModesSelected && (
        <p className="text-sm text-muted-foreground">
          No entries were extracted. The files were parsed, but the selected extraction modes did not return usable candidates.
        </p>
      )}
    </div>
  );
}
