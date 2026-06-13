import { TrashRecordCard } from "@/components/library/trash-record-card";
import { getTrashView } from "@/lib/library/service";

export default async function LibraryTrashPage() {
  const records = getTrashView();

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-2xl">🗑</p>
        <h2 className="mt-3 text-base font-semibold">Trash is empty</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Documents moved to trash appear here. Nothing is permanently deleted in V1.
        </p>
      </div>
    );
  }

  const active = records.filter((r) => !r.restoredAt);
  const restored = records.filter((r) => r.restoredAt);

  return (
    <div className="w-full max-w-6xl">
      <div className="mb-6">
        <h2 className="text-base font-semibold">Trash</h2>
        <p className="text-sm text-muted-foreground">
          {active.length} quarantined document{active.length !== 1 ? "s" : ""}
          {restored.length > 0 && ` · ${restored.length} restored`}
          {" "}· Nothing is permanently deleted here
        </p>
      </div>

      {active.length > 0 && (
        <div className="space-y-2">
          {active.map((record) => (
            <TrashRecordCard key={record.id} record={record} />
          ))}
        </div>
      )}

      {restored.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Previously restored
          </h3>
          <div className="space-y-2">
            {restored.map((record) => (
              <div key={record.id} className="rounded-xl border border-border/40 bg-muted/30 p-4 text-sm text-muted-foreground">
                <p className="truncate font-medium">{record.originalFilename}</p>
                <p className="text-xs">Restored {new Date(record.restoredAt!).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
