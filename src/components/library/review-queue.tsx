"use client";

import { ReviewCard } from "@/components/library/review-card";
import type { ReviewQueueItem } from "@/lib/library/service";
import { useState } from "react";

type ReviewQueueProps = {
  items: ReviewQueueItem[];
};

export function ReviewQueue({ items }: ReviewQueueProps) {
  const [useOllama, setUseOllama] = useState(false);
  const conflicts = items.filter((i) => i.hasConflict);
  const canonItems = items.filter((i) => i.entryType === "canon");
  const marketingItems = items.filter((i) => i.entryType === "marketing_nugget");
  const internalItems = items.filter((i) => i.entryType === "internal_note");

  return (
    <div className="w-full max-w-6xl">
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Review Queue</h2>
            <p className="text-sm text-muted-foreground">
              {items.length} candidate{items.length !== 1 ? "s" : ""} awaiting review
              {conflicts.length > 0 &&
                ` · ${conflicts.length} conflict${conflicts.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2 text-xs text-muted-foreground">
            {canonItems.length > 0 && (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-700">
                {canonItems.length} canon
              </span>
            )}
            {marketingItems.length > 0 && (
              <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-purple-700">
                {marketingItems.length} marketing
              </span>
            )}
            {internalItems.length > 0 && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
                {internalItems.length} internal
              </span>
            )}
          </div>
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-border/60 p-4">
          <input
            type="checkbox"
            checked={useOllama}
            onChange={(e) => setUseOllama(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="block text-sm font-medium">Use Ollama for queue AI actions</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Applies to rewrite and safety-review actions in this queue. Approval actions remain human-only.
            </span>
          </span>
        </label>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <ReviewCard key={item.id} entry={item} useOllama={useOllama} />
        ))}
      </div>
    </div>
  );
}