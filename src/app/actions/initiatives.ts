"use server";

import {
    archiveInitiative,
    createInitiative,
    updateInitiative,
} from "@/lib/initiatives/repository";
import type { InitiativeInput } from "@/lib/initiatives/types";
import { revalidatePath } from "next/cache";

function revalidateInitiatives() {
  revalidatePath("/initiatives");
}

export async function createInitiativeAction(input: InitiativeInput) {
  const created = createInitiative(input);
  revalidateInitiatives();
  revalidatePath(`/initiatives/${created.slug}`);
}

export async function updateInitiativeAction(slug: string, input: InitiativeInput) {
  const updated = updateInitiative(slug, input);
  revalidateInitiatives();
  revalidatePath(`/initiatives/${slug}`);
  if (updated.slug !== slug) {
    revalidatePath(`/initiatives/${updated.slug}`);
    revalidatePath(`/initiatives/${slug}/edit`);
  } else {
    revalidatePath(`/initiatives/${slug}/edit`);
  }
}

export async function deleteInitiativeAction(slug: string) {
  archiveInitiative(slug);
  revalidateInitiatives();
  revalidatePath(`/initiatives/${slug}`);
  revalidatePath(`/initiatives/${slug}/edit`);
}
