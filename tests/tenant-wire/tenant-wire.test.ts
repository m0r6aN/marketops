/**
 * w2-tenant-wire — session↔row tenant wiring evidence (no live PG needed).
 *
 * - Guard: session↔row match allows, mismatch denies (401/403 vocabulary).
 * - Repository predicates: getRowTenantId / requireRowTenantMatch /
 *   isRowVisibleToTenant across the tenant-scoped repositories.
 * - Migrations: 001-005 apply in numeric order with checksums (migrate.ts
 *   conventions); checksum divergence still refuses.
 * - Per-tenant UNIQUEs: 004 converts the exact global UNIQUEs audited from 002
 *   to composite UNIQUE(tenant_id, ...); sqlite-equivalent DDL proves
 *   cross-tenant collision allowed / within-tenant collision rejected.
 * - Suppression store: 005 carries tenant_id + backfill + index + RLS note.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  TenantScopeError,
  assertTenantAccess,
  issueSessionToken,
  requireSessionTenant,
  requireTenantMatch,
} from "@/lib/auth/session";
import {
  applyMigrations,
  getMigrationsDir,
  listMigrationFiles,
  planMigrations,
  type AppliedMigration,
  type MigrationExecutor,
} from "@/lib/db/migrate";
import { getRowTenantId as getInitiativeRowTenantId } from "@/lib/initiatives/repository";
import { requireRowTenantMatch as requireInitiativeRowTenant } from "@/lib/initiatives/repository";
import { isRowVisibleToTenant as isInitiativeRowVisible } from "@/lib/initiatives/repository";
import { getRowTenantId as getLibraryRowTenantId } from "@/lib/library/repository";
import { requireRowTenantMatch as requireLibraryRowTenant } from "@/lib/library/repository";
import { isRowVisibleToTenant as isLibraryRowVisible } from "@/lib/library/repository";
import { getRowTenantId as getCustomerFinderRowTenantId } from "@/lib/customer-finder/repository";
import { requireRowTenantMatch as requireCustomerFinderRowTenant } from "@/lib/customer-finder/repository";
import { getRowTenantId as getContentRowTenantId } from "@/lib/content-workspace/repository";
import { requireRowTenantMatch as requireContentRowTenant } from "@/lib/content-workspace/repository";
import { getRowTenantId as getAuditRowTenantId } from "@/lib/discoverability-audits/repository";
import { getRowTenantId as getReadinessRowTenantId } from "@/lib/readiness/repository";

const KEON = "tenant-keon";
const BIOSTACK = "tenant-biostack";
const TEST_KEY = "test-hmac-key-for-tenant-wire-0123456789abcdef";

let savedKey: string | undefined;

beforeEach(() => {
  savedKey = process.env.MARKETOPS_FC_HMAC_KEY;
  process.env.MARKETOPS_FC_HMAC_KEY = TEST_KEY;
});

afterEach(() => {
  if (savedKey === undefined) delete process.env.MARKETOPS_FC_HMAC_KEY;
  else process.env.MARKETOPS_FC_HMAC_KEY = savedKey;
});

// ── guard: match allow / mismatch deny ─────────────────────────────────────

describe("session↔row tenant guard", () => {
  test("match allows", () => {
    expect(assertTenantAccess(KEON, KEON, "library read")).toEqual({
      ok: true,
      tenantId: KEON,
    });
    expect(requireTenantMatch(KEON, KEON, "library read")).toBe(KEON);
  });

  test("mismatch denies 403 TENANT_MISMATCH", () => {
    const result = assertTenantAccess(KEON, BIOSTACK, "library read");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.denial.denialCode).toBe("TENANT_MISMATCH");
    expect(result.denial.httpStatus).toBe(403);
    expect(result.denial.failureStage).toBe("decision");
    expect(() => requireTenantMatch(KEON, BIOSTACK, "library read")).toThrowError(
      TenantScopeError,
    );
    try {
      requireTenantMatch(KEON, BIOSTACK, "library read");
      throw new Error("unreachable");
    } catch (error) {
      expect(error).toBeInstanceOf(TenantScopeError);
      expect((error as TenantScopeError).httpStatus).toBe(403);
    }
  });

  test("session token authorizes its own row tenant only", async () => {
    const token = issueSessionToken(KEON);
    await expect(
      requireSessionTenant({ token, resourceTenantId: KEON, action: "read" }),
    ).resolves.toBe(KEON);
    await expect(
      requireSessionTenant({ token, resourceTenantId: BIOSTACK, action: "read" }),
    ).rejects.toThrowError(TenantScopeError);
  });
});

// ── repository predicates ──────────────────────────────────────────────────

describe("repository row-tenant predicates", () => {
  test("getRowTenantId reads tenantId / tenant_id, null for legacy rows", () => {
    expect(getInitiativeRowTenantId({ tenantId: KEON })).toBe(KEON);
    expect(getLibraryRowTenantId({ tenant_id: BIOSTACK })).toBe(BIOSTACK);
    expect(getCustomerFinderRowTenantId({ tenant: KEON })).toBe(KEON);
    expect(getContentRowTenantId({})).toBeNull();
    expect(getAuditRowTenantId(null)).toBeNull();
    expect(getReadinessRowTenantId({ tenantId: "" })).toBeNull();
    // Every repository ships the same predicate contract.
    for (const fn of [
      getInitiativeRowTenantId,
      getLibraryRowTenantId,
      getCustomerFinderRowTenantId,
      getContentRowTenantId,
      getAuditRowTenantId,
      getReadinessRowTenantId,
    ]) {
      expect(fn({ tenantId: KEON })).toBe(KEON);
      expect(fn({})).toBeNull();
    }
  });

  test("requireRowTenantMatch allows match, denies mismatch 403", () => {
    expect(requireInitiativeRowTenant(KEON, { tenantId: KEON }, "update")).toBe(KEON);
    expect(requireLibraryRowTenant(BIOSTACK, { tenant_id: BIOSTACK }, "read")).toBe(
      BIOSTACK,
    );
    expect(
      requireCustomerFinderRowTenant(KEON, { tenantId: KEON }, "create"),
    ).toBe(KEON);
    expect(requireContentRowTenant(KEON, { tenantId: KEON }, "save")).toBe(KEON);
    for (const fn of [
      requireInitiativeRowTenant,
      requireLibraryRowTenant,
      requireCustomerFinderRowTenant,
      requireContentRowTenant,
    ]) {
      try {
        fn(KEON, { tenantId: BIOSTACK }, "cross-tenant probe");
        throw new Error("unreachable: cross-tenant row must be denied");
      } catch (error) {
        expect(error).toBeInstanceOf(TenantScopeError);
        expect((error as TenantScopeError).httpStatus).toBe(403);
        expect((error as TenantScopeError).denialCode).toBe("TENANT_MISMATCH");
      }
    }
  });

  test("legacy rows without a tenant column stay valid (session-owned locally)", () => {
    // Pre-tenant sqlite rows carry no tenant_id; locally they remain usable.
    // Beta PG rows always carry tenant_id and are strictly matched (see RLS).
    expect(requireInitiativeRowTenant(KEON, { slug: "x" }, "read")).toBe(KEON);
    expect(requireLibraryRowTenant(BIOSTACK, { id: "y" }, "read")).toBe(BIOSTACK);
    expect(isInitiativeRowVisible(KEON, { slug: "x" })).toBe(true);
    expect(isLibraryRowVisible(KEON, { tenantId: BIOSTACK })).toBe(false);
    expect(isLibraryRowVisible(KEON, { tenantId: KEON })).toBe(true);
  });
});

// ── migrations: order + checksums ──────────────────────────────────────────

class MockExecutor implements MigrationExecutor {
  queries: Array<{ text: string; params?: unknown[] }> = [];
  applied: AppliedMigration[] = [];

  async query<T = { version: string; checksum: string }>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }> {
    this.queries.push({ text, params });
    const head = text.trim().toUpperCase();
    if (head.startsWith("INSERT INTO SCHEMA_MIGRATIONS")) {
      const [version, , checksum] = (params ?? []) as string[];
      this.applied.push({ version, checksum });
      return { rows: [] as unknown as T[] };
    }
    if (head.startsWith("SELECT VERSION")) {
      return { rows: this.applied as unknown as T[] };
    }
    return { rows: [] as unknown as T[] };
  }
}

describe("tenant-wire migrations", () => {
  test("001-005 apply in numeric order with sha256 checksums", async () => {
    const files = listMigrationFiles(getMigrationsDir());
    expect(files.map((file) => file.version)).toEqual([
      "001",
      "002",
      "003",
      "004",
      "005",
    ]);
    expect(files.map((file) => file.fileName)).toEqual([
      "001_tenants-and-bookkeeping.sql",
      "002_core-schema.sql",
      "003_rls-policies.sql",
      "004_per-tenant-uniques.sql",
      "005_suppression-tenant.sql",
    ]);
    for (const file of files) {
      expect(file.sql.trim().length).toBeGreaterThan(0);
      expect(file.checksum).toMatch(/^[0-9a-f]{64}$/);
    }

    const executor = new MockExecutor();
    const result = await applyMigrations(executor, getMigrationsDir());
    expect(result).toEqual({ applied: ["001", "002", "003", "004", "005"] });
    const recorded = executor.queries
      .filter((query) => query.text.includes("INSERT INTO schema_migrations"))
      .map((query) => query.params?.[0]);
    expect(recorded).toEqual(["001", "002", "003", "004", "005"]);

    // Re-run is a no-op while checksums match.
    await expect(applyMigrations(executor, getMigrationsDir())).resolves.toEqual({
      applied: [],
    });

    // Bookkeeping matches the files on disk (no divergence, nothing missing).
    expect(() =>
      planMigrations(
        files.map((file) => ({ version: file.version, checksum: file.checksum })),
        files,
      ),
    ).not.toThrow();
  });

  test("checksum divergence still refuses fail-closed", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "marketops-tenant-wire-"));
    fs.writeFileSync(path.join(dir, "001_alpha.sql"), "SELECT 1;", "utf8");
    fs.writeFileSync(path.join(dir, "002_beta.sql"), "SELECT 2;", "utf8");
    const executor = new MockExecutor();
    await applyMigrations(executor, dir);
    fs.writeFileSync(path.join(dir, "002_beta.sql"), "SELECT 3;", "utf8");
    await expect(applyMigrations(executor, dir)).rejects.toThrow(
      /Checksum divergence.*002/,
    );
  });
});

// ── per-tenant UNIQUEs: SQL inspection ─────────────────────────────────────

describe("per-tenant UNIQUE migration SQL", () => {
  test("004 converts every audited global UNIQUE to UNIQUE(tenant_id, ...)", () => {
    const dir = getMigrationsDir();
    const sql002 = fs.readFileSync(path.join(dir, "002_core-schema.sql"), "utf8");
    const sql004 = fs.readFileSync(path.join(dir, "004_per-tenant-uniques.sql"), "utf8");

    // 002 keeps the global UNIQUEs verbatim (what 004 supersedes).
    for (const snippet of [
      "UNIQUE(initiative_slug, version_number)",
      "UNIQUE(content_item_id, version_number)",
      "slug TEXT NOT NULL UNIQUE",
      "request_fingerprint TEXT NOT NULL UNIQUE",
      "UNIQUE(campaign_id, source_id)",
      "UNIQUE(campaign_id, dedupe_key)",
      "contact_fingerprint TEXT NOT NULL UNIQUE",
      "UNIQUE(citation_plan_item_id, version_number)",
      "UNIQUE(email_campaign_item_id, version_number)",
      "UNIQUE(video_script_item_id, version_number)",
    ]) {
      expect(sql002).toContain(snippet);
    }

    // 004 drops each legacy global constraint and adds a per-tenant composite.
    const conversions: Array<{ table: string; old: string; cols: string }> = [
      {
        table: "brand_voice_guidelines",
        old: "brand_voice_guidelines_initiative_slug_version_number_key",
        cols: "UNIQUE (tenant_id, initiative_slug, version_number)",
      },
      {
        table: "content_versions",
        old: "content_versions_content_item_id_version_number_key",
        cols: "UNIQUE (tenant_id, content_item_id, version_number)",
      },
      {
        table: "customer_finder_campaigns",
        old: "customer_finder_campaigns_slug_key",
        cols: "UNIQUE (tenant_id, slug)",
      },
      {
        table: "customer_finder_campaigns",
        old: "customer_finder_campaigns_request_fingerprint_key",
        cols: "UNIQUE (tenant_id, request_fingerprint)",
      },
      {
        table: "customer_finder_source_runs",
        old: "customer_finder_source_runs_campaign_id_source_id_key",
        cols: "UNIQUE (tenant_id, campaign_id, source_id)",
      },
      {
        table: "customer_finder_candidates",
        old: "customer_finder_candidates_campaign_id_dedupe_key_key",
        cols: "UNIQUE (tenant_id, campaign_id, dedupe_key)",
      },
      {
        table: "customer_finder_suppressions",
        old: "customer_finder_suppressions_contact_fingerprint_key",
        cols: "UNIQUE (tenant_id, contact_fingerprint)",
      },
      {
        table: "citation_plan_versions",
        old: "citation_plan_versions_citation_plan_item_id_version_number_key",
        cols: "UNIQUE (tenant_id, citation_plan_item_id, version_number)",
      },
      {
        table: "email_campaign_versions",
        old: "email_campaign_versions_email_campaign_item_id_version_number_key",
        cols: "UNIQUE (tenant_id, email_campaign_item_id, version_number)",
      },
      {
        table: "video_script_versions",
        old: "video_script_versions_video_script_item_id_version_number_key",
        cols: "UNIQUE (tenant_id, video_script_item_id, version_number)",
      },
    ];
    expect(conversions).toHaveLength(10);
    for (const { old, cols } of conversions) {
      expect(sql004).toContain(`DROP CONSTRAINT IF EXISTS ${old}`);
      expect(sql004).toContain(cols);
    }
    // Re-runnable-safe: conditional drops + pg_constraint-guarded adds.
    expect(sql004).toContain("IF NOT EXISTS (SELECT 1 FROM pg_constraint");
  });

  test("005 ensures suppression tenant column + backfill + index + RLS", () => {
    const dir = getMigrationsDir();
    const sql005 = fs.readFileSync(
      path.join(dir, "005_suppression-tenant.sql"),
      "utf8",
    );
    expect(sql005).toContain(
      "ALTER TABLE customer_finder_suppressions ADD COLUMN IF NOT EXISTS tenant_id TEXT;",
    );
    expect(sql005).toContain(
      "UPDATE customer_finder_suppressions SET tenant_id = 'local-default' WHERE tenant_id IS NULL;",
    );
    expect(sql005).toContain("CREATE INDEX IF NOT EXISTS idx_customer_finder_suppressions_tenant");
    expect(sql005).toContain(
      "CREATE POLICY customer_finder_suppressions_tenant_isolation ON customer_finder_suppressions",
    );
    expect(sql005).toContain(
      "USING (tenant_id = current_setting('app.tenant_id', true))",
    );
  });
});

// ── per-tenant UNIQUEs: sqlite-equivalent semantics (no live PG) ────────────

describe("per-tenant unique semantics (sqlite-equivalent DDL)", () => {
  test("same key across tenants allowed, duplicate within a tenant rejected", () => {
    const mem = new Database(":memory:");
    try {
      // Mirrors the 004 composites for slugs, fingerprints, and item+version.
      mem.exec(`
        CREATE TABLE probe_campaigns (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          slug TEXT NOT NULL,
          request_fingerprint TEXT NOT NULL,
          UNIQUE (tenant_id, slug),
          UNIQUE (tenant_id, request_fingerprint)
        );
        CREATE TABLE probe_versions (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          content_item_id TEXT NOT NULL,
          version_number INTEGER NOT NULL,
          UNIQUE (tenant_id, content_item_id, version_number)
        );
        CREATE TABLE probe_suppressions (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          contact_fingerprint TEXT NOT NULL,
          UNIQUE (tenant_id, contact_fingerprint)
        );
      `);
      const campaign = mem.prepare(
        `INSERT INTO probe_campaigns (id, tenant_id, slug, request_fingerprint) VALUES (?, ?, ?, ?)`,
      );
      // Cross-tenant collision on slug + fingerprint is allowed.
      campaign.run("c1", KEON, "same-slug", "fp-1");
      expect(() =>
        campaign.run("c2", BIOSTACK, "same-slug", "fp-1"),
      ).not.toThrow();
      // Within-tenant collision is rejected.
      expect(() => campaign.run("c3", KEON, "same-slug", "fp-2")).toThrow();
      expect(() => campaign.run("c4", KEON, "other-slug", "fp-1")).toThrow();

      const version = mem.prepare(
        `INSERT INTO probe_versions (id, tenant_id, content_item_id, version_number) VALUES (?, ?, ?, ?)`,
      );
      version.run("v1", KEON, "item-1", 1);
      expect(() => version.run("v2", BIOSTACK, "item-1", 1)).not.toThrow();
      expect(() => version.run("v3", KEON, "item-1", 1)).toThrow();

      const suppression = mem.prepare(
        `INSERT INTO probe_suppressions (id, tenant_id, contact_fingerprint) VALUES (?, ?, ?)`,
      );
      suppression.run("s1", KEON, "contact-fp");
      expect(() =>
        suppression.run("s2", BIOSTACK, "contact-fp"),
      ).not.toThrow();
      expect(() => suppression.run("s3", KEON, "contact-fp")).toThrow();
    } finally {
      mem.close();
    }
  });
});
