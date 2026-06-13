import { ResolveRedFlagButton } from "@/components/library/resolve-red-flag-button";
import { getRedFlagsView } from "@/lib/library/service";

const RISK_COLORS: Record<string, string> = {
  High: "border-red-200 bg-red-50 text-red-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  Low: "border-slate-200 bg-slate-50 text-slate-700",
};

export default async function LibraryRedFlagsPage() {
  const flags = getRedFlagsView();

  if (flags.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-2xl">✓</p>
        <h2 className="mt-3 text-base font-semibold">No unresolved red flags</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Run the docs-as-marketing-review skill on a source document to surface
          risky claims here.
        </p>
      </div>
    );
  }

  const high = flags.filter((f) => f.riskLevel === "High").length;
  const medium = flags.filter((f) => f.riskLevel === "Medium").length;
  const low = flags.filter((f) => f.riskLevel === "Low").length;

  return (
    <div className="w-full max-w-6xl">
      <div className="mb-6">
        <h2 className="text-base font-semibold">Red Flags</h2>
        <p className="text-sm text-muted-foreground">
          {flags.length} unresolved · {high} high · {medium} medium · {low} low
        </p>
      </div>

      <div className="space-y-3">
        {flags.map((flag) => (
          <div
            key={flag.id}
            className="rounded-xl border border-border/60 bg-background p-5"
          >
            <div className="mb-3 flex flex-wrap items-start gap-2">
              <span
                className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
                  RISK_COLORS[flag.riskLevel] ?? RISK_COLORS.Low
                }`}
              >
                {flag.riskLevel} risk
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {new Date(flag.createdAt).toLocaleDateString()}
              </span>
            </div>

            <h3 className="mb-2 text-sm font-semibold">{flag.issue}</h3>

            <blockquote className="mb-3 border-l-2 border-border pl-3 text-xs italic text-muted-foreground">
              {flag.sourceExcerpt}
            </blockquote>

            {flag.saferWording && (
              <div className="mb-2 rounded-md bg-muted/40 p-3 text-xs">
                <div className="mb-1 font-medium text-foreground">
                  Safer wording
                </div>
                <div className="text-muted-foreground">{flag.saferWording}</div>
              </div>
            )}

            {flag.proofRequirement && (
              <div className="mb-3 rounded-md bg-muted/40 p-3 text-xs">
                <div className="mb-1 font-medium text-foreground">
                  Proof required
                </div>
                <div className="text-muted-foreground">
                  {flag.proofRequirement}
                </div>
              </div>
            )}

            <ResolveRedFlagButton id={flag.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
