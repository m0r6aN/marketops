import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { BrandVoiceGuidelineRecord } from "@/lib/brand-voice/types";
import Link from "next/link";

export function BrandVoiceSummaryCard({
  initiativeSlug,
  versions,
}: {
  initiativeSlug: string;
  versions: BrandVoiceGuidelineRecord[];
}) {
  const approved = versions.find((version) => version.status === "approved");
  const activeDraft = versions.find((version) =>
    ["draft", "review-ready", "changes-requested"].includes(version.status)
  );

  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <CardTitle className="text-base font-semibold">Brand voice guidelines</CardTitle>
            <CardDescription className="max-w-2xl">
              Initiative-specific voice, language, claim, example, and channel constraints with source
              provenance and version history.
            </CardDescription>
          </div>
          <Link
            className={buttonVariants({ size: "sm" })}
            href={`/initiatives/${initiativeSlug}/brand-voice`}
          >
            {versions.length === 0 ? "Create guidelines" : "Open brand voice"}
          </Link>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        {approved ? (
          <Badge variant="outline">Approved v{approved.versionNumber}</Badge>
        ) : (
          <Badge variant="outline">No approved version</Badge>
        )}
        {activeDraft ? (
          <Badge variant="secondary">v{activeDraft.versionNumber} {activeDraft.status}</Badge>
        ) : null}
        <Badge variant="outline">{versions.length} version{versions.length === 1 ? "" : "s"}</Badge>
      </CardContent>
    </Card>
  );
}
