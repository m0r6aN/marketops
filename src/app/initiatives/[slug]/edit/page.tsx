import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { InitiativeForm } from "@/components/initiative-form";
import { getInitiativeBySlugAnyStatus } from "@/lib/initiatives/repository";

type EditInitiativePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({
  params,
}: EditInitiativePageProps): Promise<Metadata> {
  const { slug } = await params;
  const initiative = getInitiativeBySlugAnyStatus(slug);

  return {
    title: initiative ? `Edit ${initiative.name}` : "Initiative not found",
    description: initiative
      ? `Edit operator record for ${initiative.name}.`
      : "Unknown initiative slug.",
  };
}

export default async function EditInitiativePage({ params }: EditInitiativePageProps) {
  const { slug } = await params;
  const initiative = getInitiativeBySlugAnyStatus(slug);

  if (!initiative) {
    notFound();
  }

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
          Initiative editor
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Edit {initiative.name}</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
          Update initiative positioning canon and operating posture fields.
        </p>
      </section>

      <InitiativeForm mode="edit" initialValue={initiative} />
    </div>
  );
}
