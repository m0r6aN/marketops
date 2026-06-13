import { toggleReadinessItem } from "@/app/actions/readiness";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { InitiativeReadinessView, ReadinessLevel } from "@/lib/readiness/types";

const badgeLabels: Record<ReadinessLevel, string> = {
  required: "Required",
  recommended: "Recommended",
  informational: "Informational",
};

export function ReadinessChecklist({
  readiness,
}: {
  readiness: InitiativeReadinessView;
}) {
  return (
    <div className="space-y-6">
      {readiness.groups.map((group) => (
        <Card key={group.category} className="border-border/70">
          <CardHeader>
            <CardTitle className="text-base font-semibold">{group.label}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {group.items.map((item) => (
              <form
                key={item.id}
                action={toggleReadinessItem}
                className="flex items-start justify-between gap-4 rounded-lg border border-border/70 p-4"
              >
                <input type="hidden" name="initiativeSlug" value={readiness.initiativeSlug} />
                <input type="hidden" name="definitionId" value={item.id} />
                <input type="hidden" name="complete" value={String(!item.complete)} />

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <Badge variant="outline">{badgeLabels[item.level]}</Badge>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </p>
                </div>

                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  aria-label={item.complete ? `Mark ${item.label} incomplete` : `Mark ${item.label} complete`}
                  className="min-w-24"
                >
                  {item.complete ? "Mark incomplete" : "Mark complete"}
                </Button>
              </form>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
