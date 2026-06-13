import type { CampaignSensitivity } from "@/lib/campaigns";

type CampaignSensitivityBadgeProps = {
  sensitivity: CampaignSensitivity;
};

const sensitivityLabels: Record<CampaignSensitivity, string> = {
  high: "Claim hygiene required",
  medium: "Claim care needed",
  low: "Standard care",
};

const sensitivityStyles: Record<CampaignSensitivity, string> = {
  high: "border-amber-400/60 bg-amber-50/40 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
  medium: "border-border/70 bg-muted/30 text-muted-foreground",
  low: "border-border/70 bg-muted/20 text-muted-foreground",
};

export function CampaignSensitivityBadge({
  sensitivity,
}: CampaignSensitivityBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${sensitivityStyles[sensitivity]}`}
    >
      {sensitivityLabels[sensitivity]}
    </span>
  );
}
