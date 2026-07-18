import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CustomerFinderWizard } from "@/components/customer-finder-wizard";

export const metadata: Metadata = {
  title: "Customer finder",
  description:
    "Copilot flow for target-customer suggestion, source selection, planning campaign creation, and review-only outreach drafting.",
};

export const dynamic = "force-dynamic";

export default function CustomerFinderPage() {
  return (
    <div className="space-y-6">
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to campaigns
      </Link>

      <section className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Campaign copilot
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Customer finder</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
          Build a target-customer description, choose relevant discovery sources, create one planning
          campaign, and process supported sources with provenance preserved.
        </p>
      </section>

      <CustomerFinderWizard />
    </div>
  );
}
