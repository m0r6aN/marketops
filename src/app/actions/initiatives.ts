"use server";
import { requireSessionTenant } from "@/lib/auth/session";

import {
    archiveInitiative,
    createInitiative,
    getInitiativeBySlugAnyStatus,
    requireRowTenantMatch,
    updateInitiative,
} from "@/lib/initiatives/repository";
import type { InitiativeInput } from "@/lib/initiatives/types";
import { revalidatePath } from "next/cache";

function revalidateInitiatives() {
  revalidatePath("/initiatives");
}

export async function createInitiativeAction(input: InitiativeInput) {
  // w2-tenant-wire: session tenant captured; the created row is session-owned
  // (PG RLS WITH CHECK requires tenant_id on insert — see 003/005).
  await requireSessionTenant({ action: "create initiative" });
  const created = createInitiative(input);
  revalidateInitiatives();
  revalidatePath(`/initiatives/${created.slug}`);
}

export async function updateInitiativeAction(slug: string, input: InitiativeInput) {
  // w2-tenant-wire: record tenant must match the session tenant — no path may
  // rely on session-presence alone.
  const sessionTenant = await requireSessionTenant({ action: "update initiative" });
  const existing = getInitiativeBySlugAnyStatus(slug);
  if (!existing) {
    throw new Error("Initiative not found.");
  }
  requireRowTenantMatch(sessionTenant, existing, "update initiative");
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
  // w2-tenant-wire: record tenant must match the session tenant.
  const sessionTenant = await requireSessionTenant({ action: "delete initiative" });
  const existing = getInitiativeBySlugAnyStatus(slug);
  if (!existing) {
    throw new Error("Initiative not found.");
  }
  requireRowTenantMatch(sessionTenant, existing, "delete initiative");
  archiveInitiative(slug);
  revalidateInitiatives();
  revalidatePath(`/initiatives/${slug}`);
  revalidatePath(`/initiatives/${slug}/edit`);
}
