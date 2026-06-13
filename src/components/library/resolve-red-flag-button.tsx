"use client";
import { useState } from "react";
import { resolveMarketingRedFlag } from "@/app/actions/library";

export function ResolveRedFlagButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);

  async function resolve() {
    setLoading(true);
    try {
      await resolveMarketingRedFlag(id, note.trim() || undefined);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showNote && (
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Resolution note (optional)"
          className="flex-1 min-w-0 rounded-md border border-border bg-background px-2 py-1 text-xs"
          disabled={loading}
        />
      )}
      <button
        disabled={loading}
        onClick={() => (showNote ? resolve() : setShowNote(true))}
        className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 transition-opacity hover:opacity-80 disabled:opacity-40"
      >
        {loading ? "Resolving…" : showNote ? "✓ Confirm resolve" : "✓ Mark resolved"}
      </button>
      {showNote && (
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setShowNote(false);
            setNote("");
          }}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
