import type { Metadata } from "next"

import { DashboardMetricCard } from "@/components/dashboard-metric-card"
import { InitiativeTable } from "@/components/initiative-table"
import { portfolioMetrics } from "@/lib/initiatives"

export const metadata: Metadata = {
  title: "Initiatives",
  description: "Registry of current MarketOps initiatives and their marketing focus.",
}

export default function InitiativesPage() {
  const launchStageDistribution = [
    portfolioMetrics.launchStageDistribution["public-proof"],
    portfolioMetrics.launchStageDistribution.alpha,
    portfolioMetrics.launchStageDistribution.concept,
  ]

  return (
    <div className="space-y-6">
      <section className="grid gap-4 rounded-3xl border border-border/70 bg-card/95 p-6 shadow-sm lg:grid-cols-[minmax(0,1fr)_320px] lg:p-7">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Initiatives registry
        </p>
        <div className="space-y-3 lg:col-start-1">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Initiatives</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
            This is the portfolio registry: compare each initiative&apos;s canon, audience, CTA,
            stage, and current marketing focus before opening its operator record.
          </p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-muted/25 p-4 text-sm leading-6 text-muted-foreground lg:row-span-2">
          <p className="font-medium text-foreground">Screen responsibility</p>
          <p className="mt-2">
            Use this page for canonical initiative comparison. Campaign execution belongs in
            Campaigns; executive triage belongs on Dashboard.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <DashboardMetricCard label="Active initiatives" value={portfolioMetrics.activeInitiatives.toString()} />
        <DashboardMetricCard
          label="Stage distribution"
          value={launchStageDistribution.join(" / ")}
          detail="Proof, alpha, concept"
        />
        <DashboardMetricCard
          label="Positioning reviews"
          value={portfolioMetrics.needsPositioningReviewCount.toString()}
          detail="Requires canon attention"
          tone="attention"
        />
      </section>

      <InitiativeTable />
    </div>
  )
}
