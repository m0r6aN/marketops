"use client";
import { useState } from "react";
import { updateAssetOpportunityStatus } from "@/app/actions/library";
import type { MarketingAssetStatus } from "@/lib/library/types";

const NEXT_LABELS: Record<MarketingAssetStatus, { label: string; next: MarketingAssetStatus } | null> = {
  proposed: { label: "✓ Accept", next: "accepted" },
  accepted: { label: "✎ Mark drafted", next: "drafted" },
  drafted: { label: "🚀 Mark shipped", next: "shipped" },
  shipped: null,
  rejected: null,
};

export function AssetOpportunityActions({
  id,
  status,
}: {
  id: string;
  status: MarketingAssetStatus;
}) {
  const [loading, setLoading] = useState<string | null>(null);

  async function move(next: MarketingAssetStatus, key: string) {
    setLoading(key);
    try {
      await updateAssetOpportunityStatus(id, next);
    } finally {
      setLoading(null);
    }
  }

  const advance = NEXT_LABELS[status];

  return (
    <div className="flex flex-wrap gap-2">
      {advance && (
        <button
          disabled={loading !== null}
          onClick={() => move(advance.next, "advance")}
          className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {loading === "advance" ? "Saving…" : advance.label}
        </button>
      )}
      <button
        disabled={loading !== null || status === "rejected"}
        onClick={() => move("rejected", "reject")}
        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-opacity hover:opacity-80 disabled:opacity-40"
      >
        {loading === "reject" ? "Rejecting…" : "✕ Reject"}
      </button>
    </div>
  );
}
