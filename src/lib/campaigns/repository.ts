import { requireTenantMatch } from "@/lib/auth/session";
import "@/lib/campaigns/db";

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

import { randomUUID } from "node:crypto";

import { db } from "@/lib/campaigns/db";
import type {
    CampaignLaunchReadiness,
    CampaignSensitivity,
    CampaignStatus,
    DiscoveryCampaignEditableInput,
    ManagedCampaignInput,
    ManagedCampaignRecord,
} from "@/lib/campaigns/types";
import {
    getDiscoveryCampaignRecord,
    updateCampaignProcessingState,
} from "@/lib/customer-finder/repository";

type CampaignRow = {
  id: string;
  initiative_slug: string;
  name: string;
  status: CampaignStatus;
  goal: string;
  channel: string;
  audience: string;
  primary_cta: string;
  current_focus: string;
  asset_types_json: string;
  claim_sensitivity: CampaignSensitivity;
  launch_readiness: CampaignLaunchReadiness;
  notes: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function mapRow(row: CampaignRow): ManagedCampaignRecord {
  return {
    id: row.id,
    initiativeSlug: row.initiative_slug,
    name: row.name,
    status: row.status,
    goal: row.goal,
    channel: row.channel,
    audience: row.audience,
    primaryCta: row.primary_cta,
    currentFocus: row.current_focus,
    assetTypes: JSON.parse(row.asset_types_json) as string[],
    claimSensitivity: row.claim_sensitivity,
    launchReadiness: row.launch_readiness,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? undefined,
  };
}

function toParams(input: ManagedCampaignInput, nowIso: string) {
  return {
    id: input.id || randomUUID(),
    initiative_slug: input.initiativeSlug,
    name: input.name,
    status: input.status,
    goal: input.goal,
    channel: input.channel,
    audience: input.audience,
    primary_cta: input.primaryCta,
    current_focus: input.currentFocus,
    asset_types_json: JSON.stringify(input.assetTypes),
    claim_sensitivity: input.claimSensitivity,
    launch_readiness: input.launchReadiness,
    notes: input.notes,
    updated_at: nowIso,
  };
}

export function listManagedCampaigns(options?: { includeDeleted?: boolean }): ManagedCampaignRecord[] {
  const includeDeleted = options?.includeDeleted ?? false;
  const rows = db
    .prepare(
      `SELECT * FROM campaigns ${
        includeDeleted ? "" : "WHERE deleted_at IS NULL"
      } ORDER BY name COLLATE NOCASE ASC`
    )
    .all() as CampaignRow[];

  return rows.map(mapRow);
}

export function getManagedCampaignById(
  id: string,
  options?: { includeDeleted?: boolean }
): ManagedCampaignRecord | undefined {
  const includeDeleted = options?.includeDeleted ?? false;
  const row = db
    .prepare(
      `SELECT * FROM campaigns WHERE id = ? ${
        includeDeleted ? "" : "AND deleted_at IS NULL"
      }`
    )
    .get(id) as CampaignRow | undefined;

  return row ? mapRow(row) : undefined;
}

export function createManagedCampaign(input: ManagedCampaignInput): ManagedCampaignRecord {
  const nowIso = new Date().toISOString();
  const params = toParams(input, nowIso);

  db.prepare(
    `INSERT INTO campaigns (
      id,
      initiative_slug,
      name,
      status,
      goal,
      channel,
      audience,
      primary_cta,
      current_focus,
      asset_types_json,
      claim_sensitivity,
      launch_readiness,
      notes,
      created_at,
      updated_at,
      deleted_at
    ) VALUES (
      @id,
      @initiative_slug,
      @name,
      @status,
      @goal,
      @channel,
      @audience,
      @primary_cta,
      @current_focus,
      @asset_types_json,
      @claim_sensitivity,
      @launch_readiness,
      @notes,
      @updated_at,
      @updated_at,
      NULL
    )`
  ).run(params);

  return getManagedCampaignById(params.id, { includeDeleted: true })!;
}

export function updateManagedCampaign(id: string, input: ManagedCampaignInput): ManagedCampaignRecord {
  const existing = getManagedCampaignById(id);
  if (!existing) {
    throw new Error("Campaign not found.");
  }

  const nowIso = new Date().toISOString();

  db.prepare(
    `UPDATE campaigns SET
      initiative_slug = @initiative_slug,
      name = @name,
      status = @status,
      goal = @goal,
      channel = @channel,
      audience = @audience,
      primary_cta = @primary_cta,
      current_focus = @current_focus,
      asset_types_json = @asset_types_json,
      claim_sensitivity = @claim_sensitivity,
      launch_readiness = @launch_readiness,
      notes = @notes,
      updated_at = @updated_at
    WHERE id = @id AND deleted_at IS NULL`
  ).run({
    ...toParams({ ...input, id }, nowIso),
    id,
  });

  return getManagedCampaignById(id)!;
}

export function softDeleteManagedCampaign(id: string): void {
  const nowIso = new Date().toISOString();
  db.prepare(`UPDATE campaigns SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`).run(
    nowIso,
    nowIso,
    id
  );
}

export function updateDiscoveryCampaignEditableFields(id: string, input: DiscoveryCampaignEditableInput) {
  const existing = getDiscoveryCampaignRecord(id);
  if (!existing) {
    throw new Error("Campaign not found.");
  }

  db.prepare(
    `
      UPDATE customer_finder_campaigns
      SET campaign_name = ?, initiative_slug = ?, target_description = ?, normalized_target_description = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `
  ).run(
    input.name,
    input.initiativeSlug,
    input.targetDescription,
    input.targetDescription.trim().toLowerCase().replace(/\s+/g, " "),
    input.notes,
    new Date().toISOString(),
    id
  );

  updateCampaignProcessingState({
    campaignId: id,
    notes: input.notes,
  });
}
