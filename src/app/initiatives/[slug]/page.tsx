import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { InitiativeDetailSections } from "@/components/initiative-detail-sections";
import { BrandVoiceSummaryCard } from "@/components/brand-voice-summary-card";
import { ContentWorkspaceSummaryCard } from "@/components/content-workspace-summary-card";
import { PersuasionReviewSummaryCard } from "@/components/persuasion-review-summary-card";
import { VideoScriptSummaryCard } from "@/components/video-script-summary-card";
import { YouTubeTranscriptSummaryCard } from "@/components/youtube-transcript-summary-card";
import { listBrandVoiceGuidelines } from "@/lib/brand-voice/repository";
import { listContentVersions } from "@/lib/content-workspace/repository";
import { getInitiativeBySlug } from "@/lib/initiatives/repository";
import { listPersuasionReviews } from "@/lib/persuasion-review/repository";
import { getInitiativeReadinessView } from "@/lib/readiness/service";
import { listVideoScriptVersions } from "@/lib/video-scripts/repository";
import { listYouTubeTranscripts } from "@/lib/youtube-transcripts/repository";

type InitiativePageProps = {
  params: Promise<{
    slug: string;
  }>;
};


export async function generateMetadata({
  params,
}: InitiativePageProps): Promise<Metadata> {
  const { slug } = await params;
  const initiative = getInitiativeBySlug(slug);

  return {
    title: initiative ? initiative.name : "Initiative not found",
    description: initiative
      ? `Operator detail view for ${initiative.name}.`
      : "Unknown initiative slug.",
  };
}

export default async function InitiativePage({ params }: InitiativePageProps) {
  const { slug } = await params;
  const initiative = getInitiativeBySlug(slug);

  if (!initiative) {
    notFound();
  }

  const readiness = getInitiativeReadinessView(slug);
  const brandVoiceVersions = listBrandVoiceGuidelines(slug);
  const contentVersions = listContentVersions(slug);
  const persuasionReviews = listPersuasionReviews(slug);
  const videoScriptVersions = listVideoScriptVersions(slug);
  const youtubeTranscripts = listYouTubeTranscripts(slug);

  return (
    <div className="space-y-6">
      <Link
        href="/initiatives"
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to initiatives
      </Link>

      <section className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Initiative detail
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {initiative.name}
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
          Current operator record for the initiative. Keep the route focused on the data that is
          already approved.
        </p>
      </section>

      <BrandVoiceSummaryCard initiativeSlug={slug} versions={brandVoiceVersions} />
      <ContentWorkspaceSummaryCard initiativeSlug={slug} versions={contentVersions} />
      <PersuasionReviewSummaryCard initiativeSlug={slug} reviews={persuasionReviews} />
      <VideoScriptSummaryCard initiativeSlug={slug} versions={videoScriptVersions} />
      <YouTubeTranscriptSummaryCard initiativeSlug={slug} records={youtubeTranscripts} />

      <InitiativeDetailSections initiative={initiative} readiness={readiness} />
    </div>
  );
}
