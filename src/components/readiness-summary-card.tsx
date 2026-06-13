import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { InitiativeReadinessView } from "@/lib/readiness/types";

const statusCopy = {
  blocked: "Blocked",
  needs_review: "Needs review",
  ready: "Ready",
} as const;

export function ReadinessSummaryCard({
  readiness,
}: {
  readiness: InitiativeReadinessView;
}) {
  return (
    <Card className="border-border/70">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-2">
          <CardTitle className="text-base font-semibold">Go-live readiness</CardTitle>
          <p className="text-sm text-muted-foreground">
            Readiness is based on required and recommended launch items.
          </p>
        </div>
        <Badge variant={readiness.status === "ready" ? "secondary" : "outline"}>
          {statusCopy[readiness.status]}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Progress</p>
          <p className="text-2xl font-semibold">{readiness.progressPercent}%</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Completed</p>
          <p className="text-2xl font-semibold">
            {readiness.counts.completed}/{readiness.counts.total}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Required incomplete
          </p>
          <p className="text-2xl font-semibold">{readiness.counts.requiredIncomplete}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Recommended incomplete
          </p>
          <p className="text-2xl font-semibold">{readiness.counts.recommendedIncomplete}</p>
        </div>
      </CardContent>
    </Card>
  );
}
