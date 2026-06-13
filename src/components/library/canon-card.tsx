"use client";
import { useState } from "react";
import type { LibraryEntry } from "@/lib/library/types";
import {
  lockCanon,
  deprecateCanon,
  togglePublicAutomation,
  sendToReview,
} from "@/app/actions/library";

type CanonCardProps = {
  entry: LibraryEntry;
};

const STATUS_STYLES: Record<string, string> = {
  approved: "text-green-700 bg-green-50 border-green-200",
  locked: "text-blue-700 bg-blue-50 border-blue-200",
  conflicted: "text-red-700 bg-red-50 border-red-200",
  deprecated: "text-muted-foreground bg-muted border-border",
  candidate: "text-amber-700 bg-amber-50 border-amber-200",
};

export function CanonCard({ entry }: CanonCardProps) {
  const [loading, setLoading] = useState<string | null>(null);

  async function act(key: string, fn: () => Promise<void>) {
    setLoading(key);
    try { await fn(); } finally { setLoading(null); }
  }

  const statusStyle = STATUS_STYLES[entry.status] ?? STATUS_STYLES.candidate;

  return (
    <div className="rounded-xl border border-border/60 bg-background p-5">
      <div className="mb-3 flex flex-wrap items-start gap-2">
        <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${statusStyle}`}>
          {entry.status}
        </span>
        {entry.locked && (
          <span className="rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
            🔒 Locked
          </span>
        )}
        {entry.publicAutomationAllowed && (
          <span className="rounded-md border border-green-200 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            ⚡ Automation
          </span>
        )}
        {entry.conflictStatus === "conflicted" && (
          <span className="rounded-md border border-red-200 bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            ⚠ Conflict
          </span>
        )}
        {entry.canonCategory && (
          <span className="ml-auto text-xs text-muted-foreground">
            {entry.canonCategory.replace(/_/g, " ")}
          </span>
        )}
      </div>

      <h3 className="mb-2 text-sm font-semibold">{entry.title}</h3>
      <p className="mb-3 text-sm text-muted-foreground leading-relaxed">
        {entry.canonicalStatement ?? entry.content}
      </p>

      {entry.summary && (
        <p className="mb-3 text-xs text-muted-foreground">{entry.summary}</p>
      )}

      {entry.tags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1">
          {entry.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {entry.status === "approved" && !entry.locked && (
          <button
            disabled={loading !== null}
            onClick={() => act("lock", () => lockCanon(entry.id))}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {loading === "lock" ? "Locking…" : "🔒 Lock"}
          </button>
        )}
        {!entry.publicAutomationAllowed && (entry.status === "approved" || entry.status === "locked") && (
          <button
            disabled={loading !== null}
            onClick={() => act("automation-on", () => togglePublicAutomation(entry.id, true))}
            className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {loading === "automation-on" ? "Enabling…" : "⚡ Enable Automation"}
          </button>
        )}
        {entry.publicAutomationAllowed && (
          <button
            disabled={loading !== null}
            onClick={() => act("automation-off", () => togglePublicAutomation(entry.id, false))}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {loading === "automation-off" ? "Disabling…" : "Disable Automation"}
          </button>
        )}
        {entry.status !== "deprecated" && (
          <button
            disabled={loading !== null}
            onClick={() => act("deprecate", () => deprecateCanon(entry.id))}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {loading === "deprecate" ? "Deprecating…" : "Deprecate"}
          </button>
        )}
        <button
          disabled={loading !== null}
          onClick={() => act("review", () => sendToReview(entry.id))}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {loading === "review" ? "Moving…" : "↩ Send to Review"}
        </button>
      </div>
    </div>
  );
}
