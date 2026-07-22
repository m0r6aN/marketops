import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PersuasionReviewRecord } from "@/lib/persuasion-review/types";

export function PersuasionReviewSummaryCard({
  initiativeSlug,
  reviews,
}: {
  initiativeSlug: string;
  reviews: PersuasionReviewRecord[];
}) {
  const blocked = reviews.filter((review) => review.issueFlags.some((flag) => flag.status === "blocked")).length;
  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Persuasion review</CardTitle>
            <CardDescription className="max-w-2xl">
              Ethical, evidence-aware review across seven persuasion lenses. Applying a review only creates a new editable draft.
            </CardDescription>
          </div>
          <Link className={buttonVariants({ size: "sm" })} href={`/initiatives/${initiativeSlug}/persuasion`}>
            {reviews.length ? "Open reviews" : "Start review"}
          </Link>
        </div>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Badge variant="outline">{reviews.length} review{reviews.length === 1 ? "" : "s"}</Badge>
        <Badge variant="outline">{blocked} blocked</Badge>
      </CardContent>
    </Card>
  );
}
