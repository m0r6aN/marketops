import { CanonCard } from "@/components/library/canon-card";
import { InternalNoteCard } from "@/components/library/internal-note-card";
import { MarketingNuggetCard } from "@/components/library/marketing-nugget-card";
import { ReviewCard } from "@/components/library/review-card";
import { searchLibraryEntries } from "@/lib/library/repository";
import type { LibraryEntry } from "@/lib/library/types";

function EntryCard({ entry }: { entry: LibraryEntry }) {
  if (entry.status === "candidate") return <ReviewCard entry={entry} />;
  if (entry.entryType === "canon") return <CanonCard entry={entry} />;
  if (entry.entryType === "marketing_nugget") return <MarketingNuggetCard entry={entry} />;
  if (entry.entryType === "internal_note") return <InternalNoteCard entry={entry} />;
  return null;
}

type SearchPageProps = {
  searchParams: Promise<{ q?: string; type?: string }>;
};

export default async function LibrarySearchPage({ searchParams }: SearchPageProps) {
  const sp = await searchParams;
  const query = sp.q?.trim() ?? "";
  const typeFilter = sp.type;

  const results = query
    ? searchLibraryEntries(query, typeFilter ? { entryType: typeFilter as LibraryEntry["entryType"] } : {})
    : [];

  return (
    <div className="w-full max-w-6xl">
      <div className="mb-6">
        <h2 className="text-base font-semibold">Search Library</h2>
        <p className="text-sm text-muted-foreground">
          Search across canon, marketing gold, and internal docs
        </p>
      </div>

      <form method="GET" className="mb-6 flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search entries…"
          className="flex-1 rounded-lg border border-border/60 bg-background px-4 py-2 text-sm outline-none focus:border-foreground"
          autoFocus
        />
        <select
          name="type"
          defaultValue={typeFilter ?? ""}
          className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
        >
          <option value="">All types</option>
          <option value="canon">Canon</option>
          <option value="marketing_nugget">Marketing</option>
          <option value="internal_note">Internal</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Search
        </button>
      </form>

      {query && (
        <p className="mb-4 text-xs text-muted-foreground">
          {results.length} result{results.length !== 1 ? "s" : ""} for &quot;{query}&quot;
        </p>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      {query && results.length === 0 && (
        <div className="rounded-xl border border-border/60 p-8 text-center text-sm text-muted-foreground">
          No results found for &quot;{query}&quot;
        </div>
      )}
    </div>
  );
}
