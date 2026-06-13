import type { Initiative } from "@/lib/initiatives";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AudienceBadgeList } from "@/components/audience-badge-list";
import { InitiativeLinkList } from "@/components/initiative-link-list";

type PositioningCanonCardProps = {
  initiative: Initiative;
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm leading-6 text-foreground">{value}</p>
    </div>
  );
}

export function PositioningCanonCard({ initiative }: PositioningCanonCardProps) {
  return (
    <Card className="border-border/70">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-xl font-semibold leading-tight">{initiative.name}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{initiative.stage.label}</Badge>
            <Badge variant="outline">{initiative.status.label}</Badge>
          </div>
        </div>
        <p className="text-base font-medium leading-6 text-foreground">
          {initiative.oneLiner}
        </p>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {initiative.narrative}
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <Field label="Category" value={initiative.category} />
          <Field label="Primary CTA" value={initiative.primaryCta} />
          <Field label="Current marketing focus" value={initiative.currentMarketingFocus} />
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Primary audiences
          </p>
          <AudienceBadgeList audiences={initiative.primaryAudiences} />
        </div>
        <InitiativeLinkList publicUrl={initiative.publicUrl} repoUrl={initiative.repoUrl} />
      </CardContent>
    </Card>
  );
}
