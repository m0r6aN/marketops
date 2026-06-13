import type { ClaimRule } from "@/lib/initiatives";

type ClaimListVariant = "neutral" | "caution" | "blocked";

type ClaimListProps = {
  label: string;
  claims: ClaimRule[];
  variant: ClaimListVariant;
};

const variantStyles: Record<ClaimListVariant, string> = {
  neutral: "border-border/70 bg-muted/20",
  caution: "border-amber-400/50 bg-amber-50/30 dark:bg-amber-950/20",
  blocked: "border-red-400/50 bg-red-50/30 dark:bg-red-950/20",
};

export function ClaimList({ label, claims, variant }: ClaimListProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {claims.length === 0 ? (
        <p className="text-sm text-muted-foreground">None defined.</p>
      ) : (
        <ul className="space-y-2">
          {claims.map((claim) => (
            <li
              key={claim.text}
              className={`rounded-lg border px-3 py-2 text-sm leading-6 text-foreground ${variantStyles[variant]}`}
            >
              {claim.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
