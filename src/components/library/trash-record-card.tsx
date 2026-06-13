"use client";
import { useState } from "react";
import type { TrashRecord } from "@/lib/library/types";
import { restoreFromTrash } from "@/app/actions/library";

type TrashRecordCardProps = {
  record: TrashRecord;
};

export function TrashRecordCard({ record }: TrashRecordCardProps) {
  const [loading, setLoading] = useState(false);
  const [restored, setRestored] = useState(false);

  async function handleRestore() {
    setLoading(true);
    try {
      await restoreFromTrash(record.id);
      setRestored(true);
    } finally {
      setLoading(false);
    }
  }

  if (restored) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
        ✓ Restored: {record.originalFilename}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{record.originalFilename}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{record.reason}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>Confidence: {Math.round(record.confidenceScore)}%</span>
            <span>Moved: {new Date(record.movedAt).toLocaleDateString()}</span>
          </div>
        </div>
        {record.restoreAvailable && (
          <button
            disabled={loading}
            onClick={handleRestore}
            className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {loading ? "Restoring…" : "Restore"}
          </button>
        )}
      </div>
    </div>
  );
}
