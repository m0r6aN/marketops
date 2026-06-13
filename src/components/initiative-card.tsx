import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Initiative } from "@/lib/initiatives";

type InitiativeCardProps = {
  initiative: Initiative;
};

export function InitiativeCard({ initiative }: InitiativeCardProps) {
  return (
    <Card className="h-full">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle className="text-lg font-semibold">{initiative.name}</CardTitle>
          <div className="flex flex-wrap justify-end gap-2">
            <Badge variant="secondary">{initiative.stage.label}</Badge>
            <Badge variant="outline">{initiative.status.label}</Badge>
          </div>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">{initiative.oneLiner}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Category
            </p>
            <p>{initiative.category}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Primary CTA
            </p>
            <p>{initiative.primaryCta}</p>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Current marketing focus
          </p>
          <p>{initiative.currentMarketingFocus}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Primary audiences
          </p>
          <p>{initiative.primaryAudiences.map((audience) => audience.label).join(", ")}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Claim posture
          </p>
          <p className="leading-6 text-muted-foreground">{initiative.claimPosture}</p>
        </div>
      </CardContent>
    </Card>
  );
}
