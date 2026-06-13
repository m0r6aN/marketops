"use server";

import { revalidatePath } from "next/cache";

import {
  getChecklistDefinitionsForInitiative,
  upsertChecklistState,
} from "@/lib/readiness/repository";

export async function toggleReadinessItem(formData: FormData) {
  const initiativeSlugRaw = formData.get("initiativeSlug");
  const definitionIdRaw = formData.get("definitionId");

  if (!initiativeSlugRaw || typeof initiativeSlugRaw !== "string") {
    throw new Error("Missing initiativeSlug");
  }
  if (!definitionIdRaw || typeof definitionIdRaw !== "string") {
    throw new Error("Missing definitionId");
  }

  const initiativeSlug = initiativeSlugRaw;
  const definitionId = definitionIdRaw;
  const complete = formData.get("complete") === "true";

  const validDefinitions = getChecklistDefinitionsForInitiative(initiativeSlug);
  const validDefinitionIds = new Set(validDefinitions.map((definition) => definition.id));

  if (!validDefinitionIds.has(definitionId)) {
    throw new Error("Invalid readiness definition for initiative.");
  }

  upsertChecklistState({ initiativeSlug, definitionId, complete });
  revalidatePath(`/initiatives/${initiativeSlug}`);
}
