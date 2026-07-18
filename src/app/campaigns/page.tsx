import type { Metadata } from "next";
import Link from "next/link";

import { CampaignList } from "@/components/campaign-list";
import { CustomerFinderWorkspaceActions } from "@/components/customer-finder-workspace-actions";
import { DashboardMetricCard } from "@/components/dashboard-metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCampaignMetrics, listCampaigns } from "@/lib/campaigns";

export const metadata: Metadata = {
  title: "Campaigns",
  description:
    "Campaign workspace for tracking campaign focus, channels, claim sensitivity, and customer discovery planning across the portfolio.",
};

export const dynamic = "force-dynamic";

export default function CampaignsPage() {
  const campaigns = listCampaigns();
  const campaignMetrics = getCampaignMetrics(campaigns);
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === "active");
  const planningCampaigns = campaigns.filter((campaign) => campaign.status === "planning");

  return (
    <div className="space-y-6">
      <section className="grid gap-4 rounded-3xl border border-border/70 bg-card/95 p-6 shadow-sm lg:grid-cols-[minmax(0,1fr)_340px] lg:p-7">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Campaign workspace
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Campaigns</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
            This is the execution workspace: inspect campaign goals, channels, audience, CTA,
            asset mix, launch readiness, claim sensitivity, and planning-stage customer discovery.
          </p>
          <CustomerFinderWorkspaceActions />
        </div>

        <div className="rounded-2xl border border-border/70 bg-muted/25 p-4 text-sm leading-6 text-muted-foreground">
          <p className="font-medium text-foreground">Screen responsibility</p>
          <p className="mt-2">
            Campaigns are grouped by operating state. Initiative canon stays in Initiatives;
            cross-portfolio triage stays on Dashboard; customer discovery creation starts in the
            dedicated finder flow.
          </p>
          <Link href="/campaigns/finder" className="mt-3 inline-flex font-medium text-primary hover:underline">
            Open customer finder
          </Link>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Execution metrics</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DashboardMetricCard label="Total campaigns" value={campaignMetrics.total.toString()} />
          <DashboardMetricCard label="Active" value={campaignMetrics.active.toString()} />
          <DashboardMetricCard label="Planning" value={campaignMetrics.planning.toString()} />
          <DashboardMetricCard
            label="High sensitivity"
            value={campaignMetrics.highSensitivity.toString()}
            detail="Claim hygiene required"
            tone="attention"
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader className="p-6">
            <CardTitle className="text-xl font-semibold tracking-tight">Active lanes</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <CampaignList campaigns={activeCampaigns} showInitiative density="compact" />
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader className="p-6">
            <CardTitle className="text-xl font-semibold tracking-tight">Planning queue</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <CampaignList campaigns={planningCampaigns} showInitiative density="compact" />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">All campaigns</h2>
          <Link
            href="/campaigns/new"
            className="inline-flex items-center rounded-full border border-border/70 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-muted/50"
            aria-label="Add campaign"
          >
            Add campaign
          </Link>
        </div>
        <CampaignList campaigns={campaigns} showInitiative showActions />
      </section>
    </div>
  );
}
