import type { Initiative } from "@/lib/initiatives";
import { getCampaignsByInitiativeSlug } from "@/lib/campaigns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CampaignCard } from "@/components/campaign-card";

type InitiativeCampaignsPanelProps = {
  initiative: Initiative;
};

export function InitiativeCampaignsPanel({ initiative }: InitiativeCampaignsPanelProps) {
  const initiativeCampaigns = getCampaignsByInitiativeSlug(initiative.slug);

  return (
    <Card className="border-border/70">
      <CardHeader className="space-y-2">
        <CardTitle className="text-base font-semibold">Campaigns</CardTitle>
        <CardDescription className="max-w-2xl">
          Active and planned campaigns for this initiative. Claim sensitivity and notes
          indicate where stricter wording discipline applies.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {initiativeCampaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No campaigns defined for this initiative.
          </p>
        ) : (
          <div className="space-y-4">
            {initiativeCampaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
