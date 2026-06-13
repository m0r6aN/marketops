"use client";
import { useState } from "react";
import type { LibraryEntry } from "@/lib/library/types";
import { togglePublicAutomation, archiveEntry, sendToReview } from "@/app/actions/library";

type MarketingNuggetCardProps = {
  entry: LibraryEntry;
};

export function MarketingNuggetCard({ entry }: MarketingNuggetCardProps) {
  const [loading, setLoading] = useState<string | null>(null);

  async function act(key: string, fn: () => Promise<void>) {
    setLoading(key);
    try { await fn(); } finally { setLoading(null); }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-background p-5">
      <div className="mb-3 flex flex-wrap items-start gap-2">
        <span className="rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
          {entry.status}
        </span>
        {entry.approvedForAutomation && (
          <span className="rounded-md border border-green-200 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            ⚡ Automation
          </span>
        )}
        {entry.claimRisk && entry.claimRisk !== "Low" && (
          <span
            className={
              "rounded-md border px-2 py-0.5 text-xs font-medium " +
              (entry.claimRisk === "High"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-amber-200 bg-amber-50 text-amber-700")
            }
          >
            ⚠ {entry.claimRisk} risk
          </span>
        )}
        {entry.proofStrength && (
          <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Proof: {entry.proofStrength}
          </span>
        )}
        {entry.linkBackRequired && (
          <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
            🔗 Link back required
          </span>
        )}
        {entry.suggestedChannel && (
          <span className="ml-auto text-xs text-muted-foreground">
            {entry.suggestedChannel}
          </span>
        )}
      </div>

      <h3 className="mb-2 text-sm font-semibold">{entry.title}</h3>

      {entry.marketingAngle && (
        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
          Angle: {entry.marketingAngle}
        </p>
      )}

      <p className="mb-3 text-base leading-relaxed">
        {entry.suggestedRewrite ?? entry.copyText ?? entry.content}
      </p>

      {entry.sourceExcerpt && (
        <blockquote className="mb-3 border-l-2 border-border pl-3 text-xs italic text-muted-foreground">
          {entry.sourceExcerpt.slice(0, 220)}
          {entry.sourceExcerpt.length > 220 && "…"}
        </blockquote>
      )}

      <div className="mb-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {entry.funnelStage && <span>Stage: {entry.funnelStage}</span>}
        {entry.contentType && entry.contentType.length > 0 && (
          <span>Type: {entry.contentType.join(", ")}</span>
        )}
        {entry.useFor && entry.useFor.length > 0 && (
          <span>For: {entry.useFor.slice(0, 3).join(", ")}{entry.useFor.length > 3 ? "…" : ""}</span>
        )}
        {entry.reviewAudience && entry.reviewAudience.length > 0 && (
          <span>Audience: {entry.reviewAudience.join(", ")}</span>
        )}
        {entry.suggestedUse && <span>Use: {entry.suggestedUse.replace(/_/g, " ")}</span>}
        {entry.emotionalAngle && <span>Angle: {entry.emotionalAngle}</span>}
        {entry.audience && !entry.reviewAudience && <span>Audience: {entry.audience}</span>}
        <span>Score: {Math.round(entry.confidenceScore * 100)}%</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {!entry.approvedForAutomation && entry.status === "approved" && (
          <button
            disabled={loading !== null}
            onClick={() => act("automation", () => togglePublicAutomation(entry.id, true))}
            className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {loading === "automation" ? "Enabling…" : "⚡ Approve for Automation"}
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
