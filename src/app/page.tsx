import { CampaignList } from "@/components/campaign-list";
import { DashboardMetricCard } from "@/components/dashboard-metric-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getActiveCampaigns, getCampaignMetrics, listCampaigns } from "@/lib/campaigns";
import {
    initiatives,
    portfolioMetrics,
} from "@/lib/initiatives";
import { ArrowUpRight, Layers3, ShieldAlert, Target } from "lucide-react";
import Link from "next/link";

const launchStageDistribution = [
  portfolioMetrics.launchStageDistribution["public-proof"],
  portfolioMetrics.launchStageDistribution.alpha,
  portfolioMetrics.launchStageDistribution.concept,
];

export const dynamic = "force-dynamic";

export default function Home() {
  const activeCampaigns = getActiveCampaigns();
  const campaignMetrics = getCampaignMetrics(listCampaigns());
  const initiativesNeedingReview = initiatives.filter(
    (initiative) => initiative.needsPositioningReview
  );
  const proofInitiatives = initiatives.filter(
    (initiative) => initiative.stage.key === "public-proof" || initiative.stage.key === "alpha"
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader className="space-y-4 p-6 sm:p-7">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              <Layers3 className="size-3.5" />
              Executive command center
            </div>
            <div className="space-y-3">
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight sm:text-5xl">
                Portfolio overview, attention queue, and campaign motion.
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                The dashboard is the readout layer: it summarizes health, exposes the next
                decisions, and routes operators into the right workspace without duplicating the
                full registries.
              </p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 px-6 pb-6 sm:grid-cols-3 sm:px-7 sm:pb-7">
            <Link
              href="/initiatives"
              className="rounded-2xl border border-border/70 bg-muted/25 p-4 transition-colors hover:bg-muted/45"
            >
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Registry</p>
              <p className="mt-2 text-sm font-medium">Compare initiatives and canon</p>
            </Link>
            <Link
              href="/campaigns"
              className="rounded-2xl border border-border/70 bg-muted/25 p-4 transition-colors hover:bg-muted/45"
            >
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Execution</p>
              <p className="mt-2 text-sm font-medium">Review campaign lanes and risk</p>
            </Link>
            <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Posture</p>
              <p className="mt-2 text-sm font-medium">Internal operator view only</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-foreground text-background shadow-sm dark:bg-foreground dark:text-background">
          <CardHeader className="p-6">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Target className="size-4" />
              Today&apos;s operating thesis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-6 pb-6 text-sm leading-6 text-background/75">
            <p>
              Prioritize proof-bearing initiatives while resolving positioning drift before more
              campaigns enter motion.
            </p>
            <div className="grid gap-3 border-t border-background/15 pt-4">
              <div className="flex items-center justify-between gap-3">
                <span>Proof / alpha lanes</span>
                <span className="font-semibold text-background">{proofInitiatives.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Positioning reviews</span>
                <span className="font-semibold text-background">{initiativesNeedingReview.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Active campaigns</span>
                <span className="font-semibold text-background">{activeCampaigns.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Portfolio health
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Command metrics</h2>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <DashboardMetricCard
            label="Total initiatives"
            value={portfolioMetrics.totalInitiatives.toString()}
          />
          <DashboardMetricCard
            label="Active initiatives"
            value={portfolioMetrics.activeInitiatives.toString()}
          />
          <DashboardMetricCard
            label="Launch-stage distribution"
            value={launchStageDistribution.join(" / ")}
            detail="Public proof, Alpha, Concept"
            className="xl:col-span-2"
          />
          <DashboardMetricCard
            label="Needs positioning review"
            value={portfolioMetrics.needsPositioningReviewCount.toString()}
            detail="Decision queue"
            tone="attention"
          />
          <DashboardMetricCard
            label="Campaigns in motion"
            value={campaignMetrics.active.toString()}
            detail="Active campaigns"
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.75fr)]">
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 p-6">
            <div className="space-y-1">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Attention queue
              </p>
              <CardTitle className="text-xl font-semibold tracking-tight">
                Positioning and claim-risk work
              </CardTitle>
            </div>
            <ShieldAlert className="size-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="grid gap-3 px-6 pb-6">
            {initiativesNeedingReview.map((initiative) => (
              <Link
                key={initiative.slug}
                href={`/initiatives/${initiative.slug}`}
                className="grid gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 transition-colors hover:bg-muted/40 md:grid-cols-[1fr_auto]"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{initiative.name}</p>
                    <Badge variant="outline">{initiative.stage.label}</Badge>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{initiative.claimPosture}</p>
                </div>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Open record
                  <ArrowUpRight className="size-4" />
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 p-6">
            <div className="space-y-1">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Stage map
              </p>
              <CardTitle className="text-xl font-semibold tracking-tight">Portfolio distribution</CardTitle>
            </div>
            <Link href="/initiatives" className="text-sm font-medium text-primary hover:underline">
              Registry
            </Link>
          </CardHeader>
          <CardContent className="space-y-3 px-6 pb-6">
            {initiatives.map((initiative) => (
              <div
                key={initiative.slug}
                className="flex items-start justify-between gap-3 rounded-2xl border border-border/70 bg-muted/20 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{initiative.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{initiative.currentMarketingFocus}</p>
                </div>
                <Badge variant={initiative.needsPositioningReview ? "outline" : "secondary"}>
                  {initiative.stage.label}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {activeCampaigns.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Campaign motion
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Active execution lanes</h2>
            </div>
            <Link href="/campaigns" className="text-sm font-medium text-primary hover:underline">
              View campaign workspace
            </Link>
          </div>
          <CampaignList campaigns={activeCampaigns} showInitiative />
        </section>
      )}
    </div>
  );
}
