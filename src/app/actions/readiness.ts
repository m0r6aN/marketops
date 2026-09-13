"use server";
import { requireSessionTenant } from "@/lib/auth/session";

import { revalidatePath } from "next/cache";

import {
  getChecklistDefinitionsForInitiative,
  upsertChecklistState,
} from "@/lib/readiness/repository";
import { getInitiativeBySlugAnyStatus, requireRowTenantMatch as requireInitiativeRowTenant } from "@/lib/initiatives/repository";

export async function toggleReadinessItem(formData: FormData) {
  // w2-tenant-wire: record tenant must match the session tenant. The owning
  // initiative is resolved first; a missing initiative row keeps the legacy
  // behavior (static definitions still gate validity) while PG RLS scopes the
  // state row itself (see 003).
  const sessionTenant = await requireSessionTenant({ action: "toggle readiness item" });
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

  // w2-tenant-wire: owning initiative tenant must match the session tenant
  // when the initiative row exists (legacy unknown slugs keep prior behavior).
  const initiative = getInitiativeBySlugAnyStatus(initiativeSlug);
  if (initiative) requireInitiativeRowTenant(sessionTenant, initiative, "toggle readiness item");

  const validDefinitions = getChecklistDefinitionsForInitiative(initiativeSlug);
  const validDefinitionIds = new Set(validDefinitions.map((definition) => definition.id));

  if (!validDefinitionIds.has(definitionId)) {
    throw new Error("Invalid readiness definition for initiative.");
  }

  upsertChecklistState({ initiativeSlug, definitionId, complete });
  revalidatePath(`/initiatives/${initiativeSlug}`);
}
