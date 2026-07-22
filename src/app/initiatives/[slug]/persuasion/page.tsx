import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PersuasionReviewWorkspace } from "@/components/persuasion-review-workspace";
import { getContentVersion, listContentVersions } from "@/lib/content-workspace/repository";
import { getInitiativeBySlug } from "@/lib/initiatives/repository";
import {
  getPersuasionReview,
  listPersuasionApplyRuns,
  listPersuasionReviewEvents,
  listPersuasionReviews,
} from "@/lib/persuasion-review/repository";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ contentVersion?: string; review?: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const initiative = getInitiativeBySlug((await params).slug);
  return {
    title: initiative ? `${initiative.name} Persuasion Review` : "Persuasion review",
    description: initiative ? `Ethical persuasion review for ${initiative.name}.` : "Unknown initiative.",
  };
}

export default async function PersuasionPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  const initiative = getInitiativeBySlug(slug);
  if (!initiative) notFound();

  const versions = listContentVersions(slug);
  const requestedVersion = query.contentVersion ? getContentVersion(query.contentVersion) : undefined;
  const selectedVersion = requestedVersion?.initiativeSlug === slug ? requestedVersion : versions[0];
  const reviews = listPersuasionReviews(slug);
  const requestedReview = query.review ? getPersuasionReview(query.review) : undefined;
  const selectedReview = requestedReview?.initiativeSlug === slug && requestedReview.contentVersionId === selectedVersion?.id
    ? requestedReview
    : reviews.find((review) => review.contentVersionId === selectedVersion?.id);

  return (
    <div className="space-y-6">
      <Link href={`/initiatives/${slug}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="size-4" />Back to {initiative.name}
      </Link>
      <section className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">Persuasion review</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{initiative.name} Persuasion Review</h1>
        <p className="max-w-3xl text-muted-foreground">
          Improve clarity, relevance, credibility, value, objection handling, CTA strength, and channel fit while blocking deceptive or discriminatory tactics.
        </p>
      </section>
      <PersuasionReviewWorkspace
        initiativeSlug={slug}
        versions={versions}
        selectedVersion={selectedVersion}
        reviews={reviews}
        selectedReview={selectedReview}
        applyRuns={selectedReview ? listPersuasionApplyRuns(selectedReview.id) : []}
        events={selectedReview ? listPersuasionReviewEvents(selectedReview.id) : []}
      />
    </div>
  );
}
