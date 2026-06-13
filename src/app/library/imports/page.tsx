import { getImportsView } from "@/lib/library/service";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LibraryImportsPage() {
  const batches = getImportsView();

  if (batches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-2xl">📥</p>
        <h2 className="mt-3 text-base font-semibold">No imports yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Import history will appear here.
        </p>
        <Link
          href="/library/import"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          + New Import
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Import History</h2>
          <p className="text-sm text-muted-foreground">
            {batches.length} batch{batches.length !== 1 ? "es" : ""}
          </p>
        </div>
        <Link
          href="/library/import"
          className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background"
        >
          + New Import
        </Link>
      </div>

      <div className="space-y-3">
        {batches.map((batch) => (
          <Link
            key={batch.id}
            href={`/library/imports/${batch.id}`}
            className="block rounded-xl border border-border/60 bg-background p-5 transition-colors hover:border-border hover:bg-muted/20"
          >
            <div className="mb-3 flex items-center justify-between">
              <span
                className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
                  batch.status === "completed"
                    ? "border-green-200 bg-green-50 text-green-700"
                    : batch.status === "failed"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-border bg-muted text-muted-foreground"
                }`}
              >
                {batch.status}
              </span>
              <span className="text-xs text-muted-foreground">
                {batch.startedAt
                  ? new Date(batch.startedAt).toLocaleString()
                  : new Date(batch.createdAt).toLocaleString()}
              </span>
            </div>

            <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Files", value: batch.totalFiles },
                { label: "Entries", value: batch.entriesExtracted },
                { label: "Conflicts", value: batch.conflictsDetected },
                { label: "Trash", value: batch.trashCandidates },
              ].map(({ label, value }) => (
                <div key={label} className="text-center">
                  <div className="text-base font-semibold">{value}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>

            {batch.summary && (
              <p className="mt-2 text-xs text-muted-foreground">{batch.summary}</p>
            )}

            <div className="mt-2 flex flex-wrap gap-1">
              {batch.selectedModes.map((mode) => (
                <span
                  key={mode}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {mode}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs font-medium text-muted-foreground">View details →</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
