import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CampaignDiscoveryReview } from "@/components/campaign-discovery-review";
import { CampaignRowActions } from "@/components/campaign-row-actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCampaignById } from "@/lib/campaigns";
import { getDiscoveryCampaignDetail } from "@/lib/customer-finder/repository";
import { getInitiativeBySlug } from "@/lib/initiatives";

type CampaignDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: CampaignDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const campaign = getCampaignById(id);

  return {
    title: campaign ? campaign.name : "Campaign not found",
    description: campaign ? `Detail view for ${campaign.name}.` : "Unknown campaign id.",
  };
}

export default async function CampaignDetailPage({ params }: CampaignDetailPageProps) {
  const { id } = await params;
  const campaign = getCampaignById(id);

  if (!campaign) {
    notFound();
  }

  const initiative = campaign.initiativeSlug ? getInitiativeBySlug(campaign.initiativeSlug) : undefined;
  const discoveryDetail = campaign.campaignKind === "customer-discovery" ? getDiscoveryCampaignDetail(id) : undefined;

  return (
    <div className="space-y-6">
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to campaigns
      </Link>

      <section className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Campaign detail
        </p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{campaign.name}</h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
              {campaign.goal}
            </p>
          </div>
          <CampaignRowActions
            id={campaign.id}
            name={campaign.name}
            campaignKind={campaign.campaignKind}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <SummaryCard label="Status" value={campaign.status} />
        <SummaryCard label="Audience" value={campaign.audience} />
        <SummaryCard label="Initiative" value={initiative?.name ?? "Workspace discovery"} />
      </section>

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="space-y-2 p-6">
          <CardTitle className="text-lg font-semibold">Campaign posture</CardTitle>
          <CardDescription>
            Approved campaign context, current focus, and operator notes for this lane.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 px-6 pb-6 md:grid-cols-2">
          <DetailField label="Channel" value={campaign.channel} />
          <DetailField label="Primary CTA" value={campaign.primaryCta} />
          <DetailField label="Current focus" value={campaign.currentFocus} />
          <DetailField label="Launch readiness" value={campaign.launchReadiness} />
          <DetailField label="Asset types" value={campaign.assetTypes.join(", ")} />
          <DetailField label="Notes" value={campaign.notes} />
        </CardContent>
      </Card>

      {discoveryDetail ? (
        <CampaignDiscoveryReview detail={discoveryDetail} />
      ) : (
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader className="space-y-2 p-6">
            <CardTitle className="text-lg font-semibold">Discovery workspace</CardTitle>
            <CardDescription>
              Fixture campaigns keep their original summary view. Customer discovery review is available
              on campaigns created through the Customer Finder.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6 text-sm leading-6 text-muted-foreground">
            No customer-discovery records are attached to this fixture campaign.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <CardContent className="space-y-1 px-5 py-5">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        <p className="text-base font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm leading-6">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-foreground">{value}</p>
    </div>
  );
}
