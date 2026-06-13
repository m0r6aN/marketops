import { AssetOpportunityActions } from "@/components/library/asset-opportunity-actions";
import { getAssetOpportunitiesView } from "@/lib/library/service";

const PRIORITY_COLORS: Record<string, string> = {
  High: "border-red-200 bg-red-50 text-red-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  Low: "border-slate-200 bg-slate-50 text-slate-700",
};

const STATUS_LABELS: Record<string, string> = {
  proposed: "Proposed",
  accepted: "Accepted",
  drafted: "Drafted",
};

export default async function LibraryAssetOpportunitiesPage() {
  const opportunities = getAssetOpportunitiesView();

  if (opportunities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-2xl">💡</p>
        <h2 className="mt-3 text-base font-semibold">No open opportunities</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Asset ideas from the docs-as-marketing-review skill will appear here.
        </p>
      </div>
    );
  }

  const high = opportunities.filter((o) => o.priority === "High").length;

  return (
    <div className="w-full max-w-6xl">
      <div className="mb-6">
        <h2 className="text-base font-semibold">Asset Opportunities</h2>
        <p className="text-sm text-muted-foreground">
          {opportunities.length} open · {high} high priority
        </p>
      </div>

      <div className="space-y-3">
        {opportunities.map((opp) => (
          <div
            key={opp.id}
            className="rounded-xl border border-border/60 bg-background p-5"
          >
            <div className="mb-3 flex flex-wrap items-start gap-2">
              <span
                className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
                  PRIORITY_COLORS[opp.priority] ?? PRIORITY_COLORS.Low
                }`}
              >
                {opp.priority}
              </span>
              <span className="rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {STATUS_LABELS[opp.status] ?? opp.status}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {opp.assetType}
              </span>
            </div>

            <h3 className="mb-2 text-sm font-semibold">{opp.theme}</h3>

            {opp.notes && (
              <p className="mb-3 text-xs text-muted-foreground">{opp.notes}</p>
            )}

            <AssetOpportunityActions id={opp.id} status={opp.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
