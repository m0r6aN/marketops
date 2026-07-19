import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BrandVoiceWorkspace } from "@/components/brand-voice-workspace";
import {
  getBrandVoiceGuideline,
  listBrandVoiceEvents,
  listBrandVoiceGuidelines,
  listEligibleBrandVoiceLibrarySources,
} from "@/lib/brand-voice/repository";
import { getInitiativeBySlug } from "@/lib/initiatives/repository";

type BrandVoicePageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ version?: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: BrandVoicePageProps): Promise<Metadata> {
  const { slug } = await params;
  const initiative = getInitiativeBySlug(slug);
  return {
    title: initiative ? `${initiative.name} Brand Voice` : "Brand voice not found",
    description: initiative
      ? `Versioned brand voice guidelines for ${initiative.name}.`
      : "Unknown initiative.",
  };
}

export default async function BrandVoicePage({ params, searchParams }: BrandVoicePageProps) {
  const { slug } = await params;
  const { version } = await searchParams;
  const initiative = getInitiativeBySlug(slug);
  if (!initiative) notFound();

  const versions = listBrandVoiceGuidelines(slug);
  const requested = version ? getBrandVoiceGuideline(version) : undefined;
  const selected =
    requested?.initiativeSlug === slug
      ? requested
      : versions.find((item) => ["draft", "review-ready", "changes-requested"].includes(item.status)) ??
        versions[0];
  const events = selected ? listBrandVoiceEvents(selected.id) : [];

  return (
    <div className="space-y-6">
      <Link
        href={`/initiatives/${slug}`}
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to {initiative.name}
      </Link>

      <section className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Brand voice workspace
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {initiative.name} Brand Voice
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
          Turn initiative canon and reviewed sources into a reusable voice contract for campaign and
          content workflows.
        </p>
      </section>

      <BrandVoiceWorkspace
        initiativeSlug={slug}
        initiativeName={initiative.name}
        versions={versions}
        selected={selected}
        librarySources={listEligibleBrandVoiceLibrarySources(slug)}
        events={events}
      />
    </div>
  );
}
