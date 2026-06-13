"use client";
import { useState } from "react";
import type { LibraryEntry } from "@/lib/library/types";
import { markInternalImportant, archiveEntry, promoteToPublicCandidate, sendToReview } from "@/app/actions/library";

type InternalNoteCardProps = {
  entry: LibraryEntry;
};

const SENSITIVITY_STYLES: Record<string, string> = {
  low: "text-muted-foreground bg-muted border-border",
  medium: "text-amber-700 bg-amber-50 border-amber-200",
  high: "text-red-700 bg-red-50 border-red-200",
  critical: "text-red-800 bg-red-100 border-red-300 font-semibold",
};

export function InternalNoteCard({ entry }: InternalNoteCardProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [promotionResult, setPromotionResult] = useState<string | null>(null);

  async function act(key: string, fn: () => Promise<unknown>) {
    setLoading(key);
    try {
      const result = await fn();
      if (key === "promote" && result && typeof result === "object") {
        const r = result as { promoted: boolean; reason: string; sensitiveFlags?: string[] };
        setPromotionResult(
          r.promoted
            ? "✓ Safety review passed — entry added to review queue for human approval"
            : `✕ Blocked: ${r.reason}${r.sensitiveFlags?.length ? ` (${r.sensitiveFlags.join(", ")})` : ""}`
        );
      }
    } finally {
      setLoading(null);
    }
  }

  const sensitivityStyle = entry.sensitivityLevel
    ? SENSITIVITY_STYLES[entry.sensitivityLevel] ?? SENSITIVITY_STYLES.low
    : SENSITIVITY_STYLES.low;

  return (
    <div className="rounded-xl border border-border/60 bg-background p-5">
      <div className="mb-3 flex flex-wrap items-start gap-2">
        {entry.sensitivityLevel && (
          <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${sensitivityStyle}`}>
            {entry.sensitivityLevel} sensitivity
          </span>
        )}
        {entry.status === "important" && (
          <span className="rounded-md border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            ★ Important
          </span>
        )}
        {entry.internalCategory && (
          <span className="ml-auto text-xs text-muted-foreground">
            {entry.internalCategory}
          </span>
        )}
      </div>

      <h3 className="mb-2 text-sm font-semibold">{entry.title}</h3>
      <p className="mb-2 text-sm text-muted-foreground leading-relaxed">
        {entry.summary ?? entry.content}
      </p>

      {entry.whyItMatters && (
        <p className="mb-3 text-xs text-muted-foreground border-l-2 border-border pl-3">
          <span className="font-medium">Why it matters:</span> {entry.whyItMatters}
        </p>
      )}

      {promotionResult && (
        <p className={`mb-3 text-xs ${promotionResult.startsWith("✓") ? "text-green-700" : "text-red-700"}`}>
          {promotionResult}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {entry.status !== "important" && (
          <button
            disabled={loading !== null}
            onClick={() => act("important", () => markInternalImportant(entry.id))}
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {loading === "important" ? "Saving…" : "★ Mark Important"}
          </button>
        )}
        {!entry.sensitive && (
          <button
            disabled={loading !== null}
            onClick={() => act("promote", () => promoteToPublicCandidate(entry.id))}
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {loading === "promote" ? "Reviewing…" : "↑ Promote to Public Candidate"}
          </button>
        )}
        <button
          disabled={loading !== null}
          onClick={() => act("review", () => sendToReview(entry.id))}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {loading === "review" ? "Moving…" : "↩ Send to Review"}
        </button>
        <button
          disabled={loading !== null}
          onClick={() => act("archive", () => archiveEntry(entry.id))}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {loading === "archive" ? "Archiving…" : "Archive"}
        </button>
      </div>
    </div>
  );
}
