import { requireTenantMatch } from "@/lib/auth/session";
import "@/lib/discoverability-audits/db";

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
}import { createHash,randomUUID } from "node:crypto";import { db } from "@/lib/discoverability-audits/db";import type { AuditSourceMode,AuditStatus,DiscoverabilityAuditRecord,DiscoverabilityFinding } from "@/lib/discoverability-audits/types";type Row={id:string;initiative_slug:string;requested_url:string;final_url:string;source_mode:AuditSourceMode;status:AuditStatus;provider:string;provider_version:string;content_hash:string;html_snapshot:string;seo_coverage:number;aeo_coverage:number;geo_coverage:number;findings_json:string;error_message:string;created_at:string};function findings(value:string):DiscoverabilityFinding[]{try{const parsed:unknown=JSON.parse(value);return Array.isArray(parsed)?parsed as DiscoverabilityFinding[]:[];}catch{return[];}}function map(row:Row):DiscoverabilityAuditRecord{return{id:row.id,initiativeSlug:row.initiative_slug,requestedUrl:row.requested_url,finalUrl:row.final_url,sourceMode:row.source_mode,status:row.status,provider:row.provider,providerVersion:row.provider_version,contentHash:row.content_hash,htmlSnapshot:row.html_snapshot,seoCoverage:row.seo_coverage,aeoCoverage:row.aeo_coverage,geoCoverage:row.geo_coverage,findings:findings(row.findings_json),errorMessage:row.error_message,createdAt:row.created_at};}export function listDiscoverabilityAudits(slug:string){return(db.prepare(`SELECT * FROM discoverability_audits WHERE initiative_slug=? ORDER BY created_at DESC`).all(slug) as Row[]).map(map);}export function getDiscoverabilityAudit(id:string){const row=db.prepare(`SELECT * FROM discoverability_audits WHERE id=?`).get(id) as Row|undefined;return row?map(row):undefined;}export function recordDiscoverabilityAudit(input:Omit<DiscoverabilityAuditRecord,"id"|"contentHash"|"createdAt">){const id=randomUUID(),createdAt=new Date().toISOString(),contentHash=input.htmlSnapshot?createHash("sha256").update(input.htmlSnapshot).digest("hex"):"";db.prepare(`INSERT INTO discoverability_audits VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,input.initiativeSlug,input.requestedUrl,input.finalUrl,input.sourceMode,input.status,input.provider,input.providerVersion,contentHash,input.htmlSnapshot,input.seoCoverage,input.aeoCoverage,input.geoCoverage,JSON.stringify(input.findings),input.errorMessage,createdAt);return getDiscoverabilityAudit(id)!;}export function purgeDiscoverabilityAudits(slug?:string){if(slug)db.prepare(`DELETE FROM discoverability_audits WHERE initiative_slug=?`).run(slug);else db.prepare(`DELETE FROM discoverability_audits`).run();}
