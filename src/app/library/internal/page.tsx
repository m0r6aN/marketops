import { InternalNoteCard } from "@/components/library/internal-note-card";
import { getInternalDocsView } from "@/lib/library/service";
import Link from "next/link";

export default async function LibraryInternalPage() {
  const all = getInternalDocsView();
  const active = all.filter((e) => e.status !== "archived");

  if (active.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-2xl">🗃</p>
        <h2 className="mt-3 text-base font-semibold">No internal notes yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Import files with Internal Knowledge mode to preserve private intelligence.
        </p>
        <Link
          href="/library/import"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          + Import files
        </Link>
      </div>
    );
  }

  const important = active.filter((e) => e.status === "important");
  const rest = active.filter((e) => e.status !== "important");

  return (
    <div className="w-full max-w-6xl">
      <div className="mb-6">
        <h2 className="text-base font-semibold">Internal Docs</h2>
        <p className="text-sm text-muted-foreground">
          {active.length} saved note{active.length !== 1 ? "s" : ""}
          {important.length > 0 && ` · ${important.length} important`}
        </p>
      </div>

      {important.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Important
          </h3>
          <div className="space-y-3">
            {important.map((entry) => (
              <InternalNoteCard key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}

      {rest.length > 0 && (
        <div>
          {important.length > 0 && (
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Saved
            </h3>
          )}
          <div className="space-y-3">
            {rest.map((entry) => (
              <InternalNoteCard key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
