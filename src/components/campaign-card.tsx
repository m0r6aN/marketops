import { CampaignSensitivityBadge } from "@/components/campaign-sensitivity-badge";
import { CampaignStatusBadge } from "@/components/campaign-status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Campaign } from "@/lib/campaigns";
import { cn } from "@/lib/utils";
import Link from "next/link";

type CampaignCardProps = {
  campaign: Campaign;
  initiativeName?: string;
  density?: "default" | "compact";
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm leading-6 text-foreground">{value}</p>
    </div>
  );
}

export function CampaignCard({ campaign, initiativeName, density = "default" }: CampaignCardProps) {
  const isCompact = density === "compact";

  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <CardHeader className={cn("space-y-3", isCompact && "pb-0")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <Link href={`/campaigns/${campaign.id}`} className="text-base font-semibold leading-tight hover:underline">
              {campaign.name}
            </Link>
            {initiativeName && (
              <Link
                href={`/initiatives/${campaign.initiativeSlug}`}
                className="text-sm text-muted-foreground hover:text-foreground hover:underline"
              >
                {initiativeName}
              </Link>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <CampaignStatusBadge status={campaign.status} />
            <CampaignSensitivityBadge sensitivity={campaign.claimSensitivity} />
            <Badge variant="outline">{campaign.launchReadiness}</Badge>
          </div>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{campaign.goal}</p>
      </CardHeader>
      <CardContent className={cn("space-y-4", isCompact && "pt-0")}>
        <div className={cn("grid gap-4 text-sm md:grid-cols-2", !isCompact && "lg:grid-cols-4")}>
          <Field label="Channel" value={campaign.channel} />
          <Field label="Audience" value={campaign.audience} />
          {!isCompact ? <Field label="Primary CTA" value={campaign.primaryCta} /> : null}
          {!isCompact ? <Field label="Current focus" value={campaign.currentFocus} /> : null}
        </div>
        {!isCompact ? <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Asset types</p>
          <div className="flex flex-wrap gap-2">
            {campaign.assetTypes.map((asset) => (
              <span
                key={asset}
                className="rounded-md border border-border/70 bg-muted/20 px-2 py-0.5 text-xs text-muted-foreground"
              >
                {asset}
              </span>
            ))}
          </div>
        </div> : null}
        {campaign.notes && (
          <div className="rounded-lg border border-amber-400/40 bg-amber-50/20 px-3 py-2 dark:bg-amber-950/10">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Note</p>
            <p className="mt-1 text-sm leading-6 text-foreground">{campaign.notes}</p>
            {campaign.targetDescription ? (
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Target description: {campaign.targetDescription}
              </p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
