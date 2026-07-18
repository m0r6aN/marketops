import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CampaignForm } from "@/components/campaign-form";

export const metadata: Metadata = {
  title: "New campaign",
  description: "Create a new managed campaign in the workspace.",
};

export default function NewCampaignPage() {
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
          Campaigns
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Add campaign</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
          Create a managed campaign. Customer-discovery campaign creation remains in the finder flow.
        </p>
      </section>

      <CampaignForm mode="create" kind="managed" />
    </div>
  );
}
