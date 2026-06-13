import { readinessDefinitions } from "@/lib/readiness/definitions";
import { db } from "@/lib/readiness/db";
import type { ChecklistDefinition, ChecklistStateRecord } from "@/lib/readiness/types";

type RawStateRow = {
  initiative_slug: string;
  definition_id: string;
  complete: number;
  updated_at: string;
};

export function getChecklistDefinitionsForInitiative(
  initiativeSlug: string
): ChecklistDefinition[] {
  return readinessDefinitions
    .filter((definition) => {
      if (!definition.active) return false;
      if (!definition.initiativeSlugs?.length) return true;
      return definition.initiativeSlugs.includes(initiativeSlug);
    })
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

export function getChecklistStateForInitiative(
  initiativeSlug: string
): ChecklistStateRecord[] {
  const rows = db
    .prepare(
      `
        SELECT initiative_slug, definition_id, complete, updated_at
        FROM readiness_state
        WHERE initiative_slug = ?
      `
    )
    .all(initiativeSlug) as RawStateRow[];

  return rows.map((row) => ({
    initiativeSlug: row.initiative_slug,
    definitionId: row.definition_id,
    complete: Boolean(row.complete),
    updatedAt: row.updated_at,
  }));
}

export function upsertChecklistState(input: {
  initiativeSlug: string;
  definitionId: string;
  complete: boolean;
}) {
  const updatedAt = new Date().toISOString();

  db.prepare(
    `
      INSERT INTO readiness_state (
        initiative_slug,
        definition_id,
        complete,
        updated_at
      )
      VALUES (?, ?, ?, ?)
      ON CONFLICT (initiative_slug, definition_id)
      DO UPDATE SET
        complete = excluded.complete,
        updated_at = excluded.updated_at
    `
  ).run(input.initiativeSlug, input.definitionId, input.complete ? 1 : 0, updatedAt);
}
