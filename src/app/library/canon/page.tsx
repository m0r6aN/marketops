import { CanonCard } from "@/components/library/canon-card";
import { getCanonView } from "@/lib/library/service";
import Link from "next/link";

export default async function LibraryCanonPage() {
  const entries = getCanonView();
  const approved = entries.filter((e) => e.status !== "rejected" && e.status !== "deprecated");

  if (approved.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-2xl">📖</p>
        <h2 className="mt-3 text-base font-semibold">No canon yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Import files and approve canon candidates to build the official record.
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

  const locked = approved.filter((e) => e.locked);
  const notLocked = approved.filter((e) => !e.locked);

  return (
    <div className="w-full max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Public Canon</h2>
          <p className="text-sm text-muted-foreground">
            {approved.length} approved entr{approved.length !== 1 ? "ies" : "y"}
            {locked.length > 0 && ` · ${locked.length} locked`}
          </p>
        </div>
      </div>

      {locked.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Locked
          </h3>
          <div className="space-y-3">
            {locked.map((entry) => (
              <CanonCard key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}

      {notLocked.length > 0 && (
        <div>
          {locked.length > 0 && (
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Approved
            </h3>
          )}
          <div className="space-y-3">
            {notLocked.map((entry) => (
              <CanonCard key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
