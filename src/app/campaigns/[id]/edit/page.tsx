import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CampaignForm } from "@/components/campaign-form";
import { getCampaignById } from "@/lib/campaigns";

type EditCampaignPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function generateMetadata({ params }: EditCampaignPageProps): Promise<Metadata> {
  const { id } = await params;
  const campaign = getCampaignById(id);

  return {
    title: campaign ? `Edit ${campaign.name}` : "Campaign not found",
    description: campaign ? `Edit operator fields for ${campaign.name}.` : "Unknown campaign id.",
  };
}

export default async function EditCampaignPage({ params }: EditCampaignPageProps) {
  const { id } = await params;
  const campaign = getCampaignById(id);

  if (!campaign) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/campaigns/${id}`}
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to campaign detail
      </Link>

      <section className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Campaign editor
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Edit {campaign.name}</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
          {campaign.campaignKind === "managed"
            ? "Update managed campaign fields."
            : "Update operator-owned discovery fields only. Derived discovery fields remain read-only."}
        </p>
      </section>

      <CampaignForm mode="edit" kind={campaign.campaignKind} initialValue={campaign} />
    </div>
  );
}
