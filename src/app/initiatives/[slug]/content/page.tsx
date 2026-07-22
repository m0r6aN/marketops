import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentWorkspace } from "@/components/content-workspace";
import { getCampaignsByInitiativeSlug } from "@/lib/campaigns";
import { listApprovedBrandVoiceVersions } from "@/lib/brand-voice/repository";
import { isEligibleBrandVoiceLibraryEntry } from "@/lib/brand-voice/service";
import { getContentVersion, listContentEvents, listContentGenerationRuns, listContentVersions } from "@/lib/content-workspace/repository";
import { getInitiativeBySlug } from "@/lib/initiatives/repository";
import { listLibraryEntries } from "@/lib/library/repository";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ version?: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const initiative = getInitiativeBySlug((await params).slug);
  return { title: initiative ? `${initiative.name} Content` : "Content workspace", description: initiative ? `Marketing content workspace for ${initiative.name}.` : "Unknown initiative." };
}

export default async function ContentPage({ params, searchParams }: Props) {
  const { slug } = await params; const { version } = await searchParams;
  const initiative = getInitiativeBySlug(slug); if (!initiative) notFound();
  const versions = listContentVersions(slug);
  const requested = version ? getContentVersion(version) : undefined;
  const selected = requested?.initiativeSlug === slug ? requested : versions.find((item) => ["draft", "review-ready", "changes-requested"].includes(item.status)) ?? versions[0];
  return <div className="space-y-6"><Link href={`/initiatives/${slug}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"><ArrowLeft className="size-4" />Back to {initiative.name}</Link><section className="space-y-2"><p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">Content workspace</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{initiative.name} Content</h1><p className="max-w-3xl text-muted-foreground">Draft, generate, review, and version source-backed marketing content without publishing it.</p></section><ContentWorkspace initiativeSlug={slug} initiativeName={initiative.name} versions={versions} selected={selected} brandVoices={listApprovedBrandVoiceVersions(slug, true)} campaigns={getCampaignsByInitiativeSlug(slug).map((campaign) => ({ id: campaign.id, name: campaign.name, campaignKind: campaign.campaignKind }))} sourceOptions={listLibraryEntries({ initiativeSlug: slug }).filter(isEligibleBrandVoiceLibraryEntry).map((entry) => ({ id: entry.id, title: entry.title, entryType: entry.entryType, status: entry.status }))} generationRuns={selected ? listContentGenerationRuns(selected.id) : []} events={selected ? listContentEvents(selected.id) : []} /></div>;
}
