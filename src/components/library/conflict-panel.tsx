"use client";
import { useState } from "react";
import type { ConflictRecord, LibraryEntry, ConflictResolution } from "@/lib/library/types";
import { resolveConflict } from "@/app/actions/library";

type ConflictPanelProps = {
  conflict: ConflictRecord;
  existing: LibraryEntry | null;
  challenger: LibraryEntry | null;
};

const SEVERITY_STYLES: Record<string, string> = {
  minor: "text-amber-700 bg-amber-50 border-amber-200",
  major: "text-orange-700 bg-orange-50 border-orange-200",
  critical: "text-red-700 bg-red-50 border-red-200",
};

const RESOLUTIONS: { key: ConflictResolution; label: string; description: string }[] = [
  { key: "keep_existing", label: "Keep existing", description: "Keep the current approved canon unchanged" },
  { key: "replace", label: "Replace", description: "Replace existing with the new challenger entry" },
  { key: "merge", label: "Merge", description: "Manually combine both — mark both as needing review" },
  { key: "reject_new", label: "Reject new", description: "Reject the challenger entry" },
  { key: "save_historical", label: "Save as historical", description: "Archive challenger as internal history" },
];

export function ConflictPanel({ conflict, existing, challenger }: ConflictPanelProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  async function resolve(resolution: ConflictResolution) {
    setLoading(resolution);
    try {
      await resolveConflict(conflict.id, resolution);
      setResolved(true);
    } finally {
      setLoading(null);
    }
  }

  if (resolved) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
        ✓ Conflict resolved
      </div>
    );
  }

  const severityStyle = SEVERITY_STYLES[conflict.severity] ?? SEVERITY_STYLES.minor;

  return (
    <div className="rounded-xl border border-red-200 bg-background p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${severityStyle}`}>
          {conflict.severity} conflict
        </span>
        <span className="text-xs text-muted-foreground">
          Detected {new Date(conflict.createdAt).toLocaleDateString()}
        </span>
      </div>

      <p className="mb-4 text-sm font-medium">{conflict.conflictReason}</p>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border/60 p-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">Existing (approved)</p>
          <p className="text-sm font-medium">{existing?.title ?? "Unknown entry"}</p>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-3">
            {existing?.canonicalStatement ?? existing?.content ?? "—"}
          </p>
        </div>
        <div className="rounded-lg border border-red-200/60 bg-red-50/30 p-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">New candidate</p>
          <p className="text-sm font-medium">{challenger?.title ?? "Unknown entry"}</p>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-3">
            {challenger?.canonicalStatement ?? challenger?.content ?? "—"}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Resolve this conflict:</p>
        <div className="flex flex-wrap gap-2">
          {RESOLUTIONS.map((r) => (
            <button
              key={r.key}
              disabled={loading !== null}
              title={r.description}
              onClick={() => resolve(r.key)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-opacity hover:bg-muted/60 hover:opacity-80 disabled:opacity-40"
            >
              {loading === r.key ? "Saving…" : r.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
