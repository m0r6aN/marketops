import { getImportDetailView } from "@/lib/library/service";
import type { SourceDocument } from "@/lib/library/types";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "—";
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getDocumentStatus(doc: SourceDocument): string {
  if (doc.processingStatus === "failed" || doc.parserStatus === "failed") return "failed";
  if (doc.processingStatus === "processed") return "processed";
  if (doc.processingStatus === "processing") return "processing";
  if (doc.parserStatus === "processed") return "parsed";
  return "queued";
}

function statusClass(status: string): string {
  if (status === "processed" || status === "completed") {
    return "border-green-200 bg-green-50 text-green-700";
  }
  if (status === "failed") return "border-red-200 bg-red-50 text-red-700";
  if (status === "processing") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-border bg-muted text-muted-foreground";
}

export default async function ImportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = getImportDetailView(id);
  if (!detail) notFound();

  const { batch, documents } = detail;
  const completedFiles = batch.processedFiles + batch.failedFiles;

  return (
    <div className="w-full max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/library/imports" className="text-xs text-muted-foreground hover:text-foreground">
            ← Import History
          </Link>
          <h2 className="mt-2 text-base font-semibold">Import Batch Details</h2>
          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{batch.id}</p>
        </div>
        <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${statusClass(batch.status)}`}>
          {batch.status}
        </span>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Files", value: `${completedFiles}/${batch.totalFiles}` },
          { label: "Entries", value: batch.entriesExtracted },
          { label: "Conflicts", value: batch.conflictsDetected },
          { label: "Trash candidates", value: batch.trashCandidates },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-border/60 bg-background p-4">
            <div className="text-lg font-semibold">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      <div className="mb-6 rounded-xl border border-border/60 bg-background p-4">
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Started</p>
            <p>{formatDate(batch.startedAt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Completed</p>
            <p>{formatDate(batch.completedAt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Initiative</p>
            <p>{batch.initiativeSlug ?? "Cross-initiative"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Model strategy</p>
            <p>{batch.modelStrategy}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Failed files</p>
            <p>{batch.failedFiles}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Modes</p>
            <p>{batch.selectedModes.join(", ")}</p>
          </div>
        </div>
        {batch.summary && <p className="mt-4 text-sm text-muted-foreground">{batch.summary}</p>}
      </div>

      <div className="rounded-xl border border-border/60 bg-background">
        <div className="border-b border-border/60 p-4">
          <h3 className="text-sm font-semibold">Source documents</h3>
          <p className="text-xs text-muted-foreground">
            {documents.length} document{documents.length !== 1 ? "s" : ""} tracked for this batch.
          </p>
        </div>
        <div className="divide-y divide-border/60">
          {documents.map((doc) => {
            const displayPath = doc.clientRelativePath ?? doc.originalFilename;
            const status = getDocumentStatus(doc);
            return (
              <div key={doc.id} className="grid gap-3 p-4 text-sm lg:grid-cols-[1fr_auto_auto]">
                <div className="min-w-0">
                  <p className="break-words font-medium">{displayPath}</p>
                  {doc.clientRelativePath && (
                    <p className="text-xs text-muted-foreground">file: {doc.originalFilename}</p>
                  )}
                  {doc.errorMessage && <p className="mt-1 text-xs text-red-600">{doc.errorMessage}</p>}
                </div>
                <div className="text-xs text-muted-foreground lg:text-right">
                  <p>{doc.mimeType || "unknown type"}</p>
                  <p>{formatFileSize(doc.fileSize)}</p>
                </div>
                <div className="lg:text-right">
                  <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${statusClass(status)}`}>
                    {status}
                  </span>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(doc.ingestedAt)}</p>
                </div>
              </div>
            );
          })}
          {documents.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No source documents were recorded.</p>
          )}
        </div>
      </div>
    </div>
  );
}