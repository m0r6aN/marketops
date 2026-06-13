import type { AudienceSegment } from "@/lib/initiatives";
import { Badge } from "@/components/ui/badge";

type AudienceBadgeListProps = {
  audiences: AudienceSegment[];
};

export function AudienceBadgeList({ audiences }: AudienceBadgeListProps) {
  if (audiences.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {audiences.map((audience) => (
        <Badge key={audience.label} variant="secondary">
          {audience.label}
        </Badge>
      ))}
    </div>
  );
}
