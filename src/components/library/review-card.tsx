"use client";
import {
    approveAsCanon,
    approveAsInternal,
    approveAsMarketing,
    flagSensitive,
    rejectEntry,
    requestStrongModelReview,
    rewriteAsMarketing,
} from "@/app/actions/library";
import type { LibraryEntry } from "@/lib/library/types";
import { useState } from "react";

type ReviewCardProps = {
  entry: LibraryEntry & { hasConflict?: boolean };
  useOllama?: boolean;
};

const TYPE_LABELS: Record<string, string> = {
  canon: "Canon",
  marketing_nugget: "Marketing",
  internal_note: "Internal",
};

const TYPE_COLORS: Record<string, string> = {
  canon: "text-blue-700 bg-blue-50 border-blue-200",
  marketing_nugget: "text-purple-700 bg-purple-50 border-purple-200",
  internal_note: "text-amber-700 bg-amber-50 border-amber-200",
};

export function ReviewCard({ entry, useOllama = false }: ReviewCardProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function act(
    action: string,
    fn: () => Promise<unknown>,
    hideWhenDone = true
  ) {
    setLoading(action);
    try {
      await fn();
      if (hideWhenDone) setDone(true);
    } finally {
      setLoading(null);
    }
  }

  if (done) return null;

  const typeColor = TYPE_COLORS[entry.entryType] ?? "text-muted-foreground bg-muted border-border";
  const typeLabel = TYPE_LABELS[entry.entryType] ?? entry.entryType;

  return (
    <div
      className={`rounded-xl border p-5 ${
        entry.hasConflict
          ? "border-red-200 bg-red-50/30"
          : "border-border/60 bg-background"
      }`}
    >
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-start gap-2">
        <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${typeColor}`}>
          {typeLabel}
        </span>
        {entry.hasConflict && (
          <span className="rounded-md border border-red-200 bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            ⚠ Conflict
          </span>
        )}
        {entry.sensitive && (
          <span className="rounded-md border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            Sensitive
          </span>
        )}
        {entry.publicSafe && (
          <span className="rounded-md border border-green-200 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            Public-safe
          </span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          Confidence {Math.round(entry.confidenceScore * 100)}% · Memory value {Math.round(entry.memoryValueScore)}
        </span>
      </div>

      {/* Title */}
      <h3 className="mb-2 text-sm font-semibold">{entry.title}</h3>

      {/* Main content */}
      <p className="mb-3 text-sm text-muted-foreground leading-relaxed">
        {entry.canonicalStatement ?? entry.copyText ?? entry.content ?? entry.summary}
      </p>

      {/* Source quote */}
      {entry.sourceQuote && (
        <blockquote className="mb-3 border-l-2 border-border pl-3 text-xs text-muted-foreground italic">
          {entry.sourceQuote.slice(0, 200)}
          {entry.sourceQuote.length > 200 && "…"}
        </blockquote>
      )}

      {/* Metadata row */}
      <div className="mb-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {entry.canonCategory && <span>Category: {entry.canonCategory.replace(/_/g, " ")}</span>}
        {entry.suggestedUse && <span>Use: {entry.suggestedUse.replace(/_/g, " ")}</span>}
        {entry.suggestedChannel && <span>Channel: {entry.suggestedChannel}</span>}
        {entry.internalCategory && <span>Category: {entry.internalCategory}</span>}
        {entry.sensitivityLevel && <span>Sensitivity: {entry.sensitivityLevel}</span>}
        {entry.sourceLocation && <span>Source: {entry.sourceLocation}</span>}
        {entry.modelUsed && <span>Model: {entry.modelUsed}</span>}
      </div>

      {/* Tags */}
      {entry.tags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1">
          {entry.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          disabled={loading !== null}
          onClick={() => act("canon", () => approveAsCanon(entry.id))}
          className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {loading === "canon" ? "Saving…" : "✓ Approve as Canon"}
        </button>
        <button
          disabled={loading !== null}
          onClick={() => act("marketing", () => approveAsMarketing(entry.id))}
          className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {loading === "marketing" ? "Saving…" : "✓ Approve as Marketing"}
        </button>
        <button
          disabled={loading !== null}
          onClick={() => act("rewrite", () => rewriteAsMarketing(entry.id, { useOllama }))}
          className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {loading === "rewrite" ? "Rewriting…" : "✦ Rewrite as Marketing"}
        </button>
        <button
          disabled={loading !== null}
          onClick={() =>
            act("safety", () => requestStrongModelReview(entry.id, { useOllama }), false)
          }
          className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {loading === "safety" ? "Reviewing…" : "🛡 Run Safety Review"}
        </button>
        <button
          disabled={loading !== null}
          onClick={() => act("internal", () => approveAsInternal(entry.id))}
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {loading === "internal" ? "Saving…" : "✓ Save as Internal"}
        </button>
        <button
          disabled={loading !== null}
          onClick={() => act("sensitive", () => flagSensitive(entry.id))}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {loading === "sensitive" ? "Flagging…" : "⚑ Flag Sensitive"}
        </button>
        <button
          disabled={loading !== null}
          onClick={() => act("reject", () => rejectEntry(entry.id))}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {loading === "reject" ? "Rejecting…" : "✕ Reject"}
        </button>
      </div>
    </div>
  );
}
