import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { InitiativeForm } from "@/components/initiative-form";

export const metadata: Metadata = {
  title: "New initiative",
  description: "Create a new initiative in the registry.",
};

export default function NewInitiativePage() {
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
          Initiatives
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Add initiative</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
          Create a new initiative record with positioning canon, claim posture, and operator links.
        </p>
      </section>

      <InitiativeForm mode="create" />
    </div>
  );
}
