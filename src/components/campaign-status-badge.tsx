import type { CampaignStatus } from "@/lib/campaigns";
import { Badge } from "@/components/ui/badge";

type CampaignStatusBadgeProps = {
  status: CampaignStatus;
};

const statusLabels: Record<CampaignStatus, string> = {
  active: "Active",
  paused: "Paused",
  planning: "Planning",
  complete: "Complete",
};

const statusVariants: Record<
  CampaignStatus,
  "default" | "secondary" | "outline"
> = {
  active: "default",
  paused: "outline",
  planning: "secondary",
  complete: "outline",
};

export function CampaignStatusBadge({ status }: CampaignStatusBadgeProps) {
  return (
    <Badge variant={statusVariants[status]}>{statusLabels[status]}</Badge>
  );
}
