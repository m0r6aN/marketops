import { requireTenantMatch } from "@/lib/auth/session";
import { readinessDefinitions } from "@/lib/readiness/definitions";

// ── w2-tenant-wire: row-tenant predicate (forward-compatible) ───────────────
// SQLite rows predate tenant_id (see db/migrations/002 for the PG schema); PG
// rows carry tenant_id NOT NULL. getRowTenantId returns the row tenant when the
// record carries one (tenantId / tenant_id / tenant), else null for legacy
// local-default sqlite rows. requireRowTenantMatch enforces session == row via
// requireTenantMatch when a tenant is present; legacy rows without a tenant
// column are treated as session-owned (single-tenant local sqlite) — beta PG
// isolation is enforced by RLS (003/005) plus the per-tenant UNIQUEs (004).
// Local-default rows stay valid; 'local-default' must never appear in beta.
export function getRowTenantId(row: unknown): string | null {
  if (typeof row !== "object" || row === null) return null;
  const record = row as Record<string, unknown>;
  const value = record.tenantId ?? record.tenant_id ?? record.tenant ?? null;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function requireRowTenantMatch(
  sessionTenantId: string,
  row: unknown,
  action: string,
): string {
  const rowTenantId = getRowTenantId(row);
  if (rowTenantId === null) return sessionTenantId;
  return requireTenantMatch(sessionTenantId, rowTenantId, action);
}

export function isRowVisibleToTenant(sessionTenantId: string, row: unknown): boolean {
  const rowTenantId = getRowTenantId(row);
  if (rowTenantId === null) return true;
  return rowTenantId === sessionTenantId;
}
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
