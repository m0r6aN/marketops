import { MarketingNuggetCard } from "@/components/library/marketing-nugget-card";
import { getMarketingGoldView } from "@/lib/library/service";
import Link from "next/link";

export default async function LibraryMarketingPage() {
  const entries = getMarketingGoldView({ status: "approved" });
  const all = getMarketingGoldView();
  const candidates = all.filter((e) => e.status === "candidate");

  if (entries.length === 0 && candidates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-2xl">💬</p>
        <h2 className="mt-3 text-base font-semibold">No marketing gold yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Import files with Marketing mode enabled to find copy candidates.
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

  return (
    <div className="w-full max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Marketing Gold</h2>
          <p className="text-sm text-muted-foreground">
            {entries.length} approved
            {candidates.length > 0 && (
              <Link href="/library/review" className="ml-2 text-amber-600 hover:underline">
                · {candidates.length} in review queue
              </Link>
            )}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {entries.map((entry) => (
          <MarketingNuggetCard key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
