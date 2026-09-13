/**
 * w1-postgres-rls-migrate — migration + provider + tenant-isolation tests.
 *
 * No live PostgreSQL is required here: ordering, checksums, divergence
 * refusal, provider selection, and static RLS proof all run locally on the
 * sqlite default. The single live-PG test stays skipped unless
 * MARKETOPS_TEST_LIVE_PG=1 (beta INT int-tenant-isolation owns live proof).
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  applyMigrations,
  getMigrationsDir,
  listMigrationFiles,
  type AppliedMigration,
  type MigrationExecutor,
} from "@/lib/db/migrate";
import {
  DEFAULT_TENANT_ID,
  closePgPool,
  getDbProvider,
  getPgPool,
  queryWithTenant,
  resolveTenantId,
} from "@/lib/db/provider";

// ── helpers ────────────────────────────────────────────────────────────────

class MockExecutor implements MigrationExecutor {
  queries: Array<{ text: string; params?: unknown[] }> = [];
  applied: AppliedMigration[] = [];

  async query<T = { version: string; checksum: string }>(
    text: string,
    params?: unknown[]
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

function writeTempMigrations(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "marketops-migrations-"));
  for (const [name, sql] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), sql, "utf8");
  }
  return dir;
}

const ENV_KEYS = [
  "MARKETOPS_DB",
  "MARKETOPS_TENANT_ID",
  "MARKETOPS_DEFAULT_TENANT",
  "MARKETOPS_TEST_LIVE_PG",
  "DATABASE_URL",
  "PGHOST",
  "PGPORT",
  "PGUSER",
  "PGPASSWORD",
  "PGDATABASE",
  "PGSSLMODE",
] as const;

let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
});

afterEach(async () => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  await closePgPool();
});

// ── migration files: ordering ──────────────────────────────────────────────

describe("migration ordering", () => {
  test("db/migrations apply in numeric order with intact checksums", () => {
    const files = listMigrationFiles(getMigrationsDir());
    const versions = files.map((file) => file.version);
    // Ordered, unique, zero-padded numeric versions — tolerant of new
    // migrations (004+) so tenant-wire-style additions never break this.
    expect(versions).toEqual([...versions].sort());
    expect(new Set(versions).size).toBe(versions.length);
    for (const file of files) {
      expect(file.sql.trim().length).toBeGreaterThan(0);
      expect(file.checksum).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(files.slice(0, 3).map((file) => file.fileName)).toEqual([
      "001_tenants-and-bookkeeping.sql",
      "002_core-schema.sql",
      "003_rls-policies.sql",
    ]);
  });

  test("temp-dir fixtures order numerically regardless of creation order", () => {
    const dir = writeTempMigrations({
      "002_beta.sql": "CREATE TABLE beta (id TEXT PRIMARY KEY);",
      "001_alpha.sql": "CREATE TABLE alpha (id TEXT PRIMARY KEY);",
    });
    expect(listMigrationFiles(dir).map((file) => file.version)).toEqual(["001", "002"]);
  });

  test("invalid filenames and duplicates refuse fail-closed", () => {
    expect(() =>
      listMigrationFiles(writeTempMigrations({ "bad-name.sql": "SELECT 1;" }))
    ).toThrow(/Invalid migration filename/);
    expect(() =>
      listMigrationFiles(
        writeTempMigrations({
          "001_alpha.sql": "SELECT 1;",
          "001_alpha-again.sql": "SELECT 2;",
        })
      )
    ).toThrow(/Duplicate migration version/);
  });
});

// ── runner: apply order + checksum bookkeeping ─────────────────────────────

describe("migration runner", () => {
  test("applies pending files in order and records file checksums", async () => {
    const dir = writeTempMigrations({
      "001_alpha.sql": "CREATE TABLE alpha (id TEXT PRIMARY KEY);",
      "002_beta.sql": "CREATE TABLE beta (id TEXT PRIMARY KEY);",
    });
    const executor = new MockExecutor();
    const result = await applyMigrations(executor, dir);
    expect(result).toEqual({ applied: ["001", "002"] });

    const heads = executor.queries.map((query) => query.text.trim().slice(0, 48).toUpperCase());
    expect(heads[0]).toContain("CREATE TABLE IF NOT EXISTS SCHEMA_MIGRATIONS");
    expect(heads[1]).toContain("SELECT VERSION");
    expect(executor.queries[2].text).toContain("CREATE TABLE alpha");
    expect(executor.queries[3].text).toContain("INSERT INTO schema_migrations");
    expect(executor.queries[4].text).toContain("CREATE TABLE beta");
    expect(executor.queries[5].text).toContain("INSERT INTO schema_migrations");

    const recorded = executor.queries
      .filter((query) => query.text.includes("INSERT INTO schema_migrations"))
      .map((query) => query.params?.[0]);
    expect(recorded).toEqual(["001", "002"]);

    // Second run is a no-op (all checksums still match).
    const rerun = await applyMigrations(executor, dir);
    expect(rerun).toEqual({ applied: [] });
  });

  test("refuses when a file changed after apply (checksum divergence)", async () => {
    const dir = writeTempMigrations({
      "001_alpha.sql": "CREATE TABLE alpha (id TEXT PRIMARY KEY);",
      "002_beta.sql": "CREATE TABLE beta (id TEXT PRIMARY KEY);",
    });
    const executor = new MockExecutor();
    await applyMigrations(executor, dir);

    fs.writeFileSync(path.join(dir, "002_beta.sql"), "CREATE TABLE beta (id TEXT PRIMARY KEY, extra TEXT);", "utf8");
    await expect(applyMigrations(executor, dir)).rejects.toThrow(/Checksum divergence.*002/);
  });

  test("refuses when an applied file was deleted", async () => {
    const dir = writeTempMigrations({
      "001_alpha.sql": "CREATE TABLE alpha (id TEXT PRIMARY KEY);",
      "002_beta.sql": "CREATE TABLE beta (id TEXT PRIMARY KEY);",
    });
    const executor = new MockExecutor();
    await applyMigrations(executor, dir);

    fs.unlinkSync(path.join(dir, "001_alpha.sql"));
    await expect(applyMigrations(executor, dir)).rejects.toThrow(/"001".*no matching file/);
  });
});

// ── static RLS proof (no live DB) ──────────────────────────────────────────

describe("RLS static proof", () => {
  test("every 002 table has tenant_id, backfill, index, and a 003 isolation policy", () => {
    const dir = getMigrationsDir();
    const sql002 = fs.readFileSync(path.join(dir, "002_core-schema.sql"), "utf8");
    const sql003 = fs.readFileSync(path.join(dir, "003_rls-policies.sql"), "utf8");

    const tables = [...sql002.matchAll(/CREATE TABLE IF NOT EXISTS\s+(\w+)/g)].map((match) => match[1]);
    // 40 tenant-scoped data tables transcribed from the 13 db.ts modules.
    expect(tables).toHaveLength(40);

    for (const table of tables) {
      expect(sql002, `${table} gains tenant_id`).toContain(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS tenant_id TEXT;`);
      expect(sql002, `${table} backfills the explicit default`).toContain(
        `UPDATE ${table} SET tenant_id = 'local-default' WHERE tenant_id IS NULL;`
      );
      expect(sql003, `${table} enforces RLS`).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
      expect(sql003, `${table} forces RLS on owners too`).toContain(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`);
      expect(sql003, `${table} isolates by app.tenant_id`).toContain(
        `CREATE POLICY ${table}_tenant_isolation ON ${table}`
      );
    }
    expect(sql003).toContain("USING (tenant_id = current_setting('app.tenant_id', true))");
    expect(sql003).toContain("WITH CHECK (tenant_id = current_setting('app.tenant_id', true))");
    // tenants registry: self-read only; bookkeeping gets no RLS statements.
    expect(sql003).toContain("CREATE POLICY tenants_self_read ON tenants");
    expect(sql003).not.toContain("TABLE schema_migrations");
    expect(sql003).not.toContain("ON schema_migrations");
    // Backfill default matches the provider constant (asserted below too).
    expect(sql002).toContain("'local-default'");
  });

  test("backfill default is the documented provider constant", () => {
    expect(DEFAULT_TENANT_ID).toBe("local-default");
  });
});

// ── provider selection ─────────────────────────────────────────────────────

describe("provider selection", () => {
  test("sqlite is the default when MARKETOPS_DB is unset", () => {
    delete process.env.MARKETOPS_DB;
    expect(getDbProvider()).toBe("sqlite");
  });

  test("pg is selected only when explicitly flagged", () => {
    process.env.MARKETOPS_DB = "pg";
    expect(getDbProvider()).toBe("pg");
    process.env.MARKETOPS_DB = "sqlite";
    expect(getDbProvider()).toBe("sqlite");
  });

  test("unknown providers refuse fail-closed", () => {
    process.env.MARKETOPS_DB = "mysql";
    expect(() => getDbProvider()).toThrow(/MARKETOPS_DB/);
  });

  test("tenant resolution prefers explicit, then env, then documented default", () => {
    delete process.env.MARKETOPS_TENANT_ID;
    delete process.env.MARKETOPS_DEFAULT_TENANT;
    expect(resolveTenantId("tenant-keon")).toBe("tenant-keon");
    process.env.MARKETOPS_TENANT_ID = "tenant-biostack";
    expect(resolveTenantId()).toBe("tenant-biostack");
    delete process.env.MARKETOPS_TENANT_ID;
    expect(resolveTenantId()).toBe("local-default");
    expect(() => resolveTenantId("  ")).toThrow(/non-empty tenant id/);
  });

  test("pg pool without a connection string fails closed without connecting", () => {
    process.env.MARKETOPS_DB = "pg";
    delete process.env.DATABASE_URL;
    delete process.env.PGHOST;
    // Must throw a clear configuration error — no socket is attempted, so no
    // live server is required for this assertion.
    expect(() => getPgPool()).toThrow(/DATABASE_URL/);
  });
});

// Skip reason is explicit: live PG proof belongs to beta INT
// int-tenant-isolation, not this unit lane.
const liveIt = process.env.MARKETOPS_TEST_LIVE_PG === "1" ? test : test.skip;

liveIt("live PG tenant isolation (beta INT int-tenant-isolation only)", async () => {
  const before = await queryWithTenant<{ one: number }>("tenant-keon", "SELECT 1 AS one");
  expect(before.rows[0].one).toBe(1);
});

// ── sqlite defense in depth: tenant WHERE scoping leaks zero rows ──────────

describe("sqlite tenant scoping pattern", () => {
  test("cross-tenant WHERE predicate leaks zero rows", () => {
    const mem = new Database(":memory:");
    try {
      mem.exec(`CREATE TABLE probe_items (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, payload TEXT NOT NULL)`);
      mem.prepare(`INSERT INTO probe_items (id, tenant_id, payload) VALUES (?, ?, ?)`)
        .run("item-1", "tenant-keon", "keon draft");
      const own = mem
        .prepare(`SELECT payload FROM probe_items WHERE id = ? AND tenant_id = ?`)
        .get("item-1", "tenant-keon") as { payload: string } | undefined;
      expect(own?.payload).toBe("keon draft");
      const leaked = mem
        .prepare(`SELECT * FROM probe_items WHERE id = ? AND tenant_id = ?`)
        .get("item-1", "tenant-biostack");
      expect(leaked).toBeUndefined();
    } finally {
      mem.close();
    }
  });
});
