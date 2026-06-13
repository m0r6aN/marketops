import type { Initiative } from "@/lib/initiatives";
import type { InitiativeReadinessView } from "@/lib/readiness/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReadinessChecklist } from "@/components/readiness-checklist";
import { ReadinessSummaryCard } from "@/components/readiness-summary-card";
import { PositioningCanonCard } from "@/components/positioning-canon-card";
import { ClaimHygienePanel } from "@/components/claim-hygiene-panel";
import { InitiativeCampaignsPanel } from "@/components/initiative-campaigns-panel";

type InitiativeDetailSectionsProps = {
  initiative: Initiative;
  readiness: InitiativeReadinessView;
};

type PlaceholderSectionProps = {
  title: string;
  description: string;
  note: string;
};

function PlaceholderSection({ title, description, note }: PlaceholderSectionProps) {
  return (
    <Card className="border-border/70">
      <CardHeader className="space-y-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <CardDescription className="max-w-2xl">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-6 text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}

export function InitiativeDetailSections({
  initiative,
  readiness,
}: InitiativeDetailSectionsProps) {
  return (
    <div className="space-y-6">
      <ReadinessSummaryCard readiness={readiness} />

      <PositioningCanonCard initiative={initiative} />

      <Card className="border-border/70">
        <CardHeader className="space-y-2">
          <CardTitle className="text-base font-semibold">Go-live checklist</CardTitle>
          <CardDescription className="max-w-2xl">
            Shared and initiative-specific launch items are tracked together here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReadinessChecklist readiness={readiness} />
        </CardContent>
      </Card>

      <ClaimHygienePanel initiative={initiative} />

      <div className="grid gap-6">
        <InitiativeCampaignsPanel initiative={initiative} />
        <PlaceholderSection
          title="Assets"
          description="Reserved for approved assets, source links, and version state."
          note="Asset inventory will land in a later task."
        />
        <PlaceholderSection
          title="Metrics"
          description="Reserved for the task-local performance readout and review cadence."
          note="Metrics are not wired into this detail route yet."
        />
      </div>
    </div>
  );
}
