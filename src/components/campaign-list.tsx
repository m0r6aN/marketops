import { CampaignCard } from "@/components/campaign-card";
import type { Campaign } from "@/lib/campaigns";
import { initiatives } from "@/lib/initiatives";

type CampaignListProps = {
  campaigns: Campaign[];
  showInitiative?: boolean; // defaults to false; pass true to render initiative name links
  density?: "default" | "compact";
};

function getInitiativeName(slug: string): string | undefined {
  return initiatives.find((i) => i.slug === slug)?.name;
}

export function CampaignList({
  campaigns,
  showInitiative = false,
  density = "default",
}: CampaignListProps) {
  if (campaigns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No campaigns defined.</p>
    );
  }

  return (
    <div className={density === "compact" ? "grid gap-3" : "grid gap-4 lg:grid-cols-2"}>
      {campaigns.map((campaign) => (
        <CampaignCard
          key={campaign.id}
          campaign={campaign}
          density={density}
          initiativeName={
            showInitiative ? getInitiativeName(campaign.initiativeSlug) : undefined
          }
        />
      ))}
    </div>
  );
}
