import { ConflictPanel } from "@/components/library/conflict-panel";
import { getLibraryEntry } from "@/lib/library/repository";
import { getConflictsView } from "@/lib/library/service";

export default async function LibraryConflictsPage() {
  const conflicts = getConflictsView();

  if (conflicts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-2xl">✓</p>
        <h2 className="mt-3 text-base font-semibold">No unresolved conflicts</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          All canon entries are consistent.
        </p>
      </div>
    );
  }

  const withEntries = conflicts.map((c) => ({
    conflict: c,
    existing: getLibraryEntry(c.existingEntryId),
    challenger: getLibraryEntry(c.challengerEntryId),
  }));

  return (
    <div className="w-full max-w-6xl">
      <div className="mb-6">
        <h2 className="text-base font-semibold">Conflicts</h2>
        <p className="text-sm text-muted-foreground">
          {conflicts.length} unresolved conflict{conflicts.length !== 1 ? "s" : ""} between new extractions and existing canon
        </p>
      </div>

      <div className="space-y-4">
        {withEntries.map(({ conflict, existing, challenger }) => (
          <ConflictPanel
            key={conflict.id}
            conflict={conflict}
            existing={existing}
            challenger={challenger}
          />
        ))}
      </div>
    </div>
  );
}
