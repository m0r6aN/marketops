/**
 * w1-postgres-rls-migrate — database provider switch.
 *
 * Decision (already made, do not relitigate): Azure PostgreSQL Flexible Server
 * for beta; local dev stays SQLite by default.
 *
 * - `MARKETOPS_DB=sqlite` (default) keeps the current better-sqlite3 behaviour.
 *   The exported `db` singleton is byte-for-byte the same connection the app
 *   used before this parcel (same file, same creation logic), so all 13
 *   `src/lib/*\/db.ts` modules behave identically on the default path.
 * - `MARKETOPS_DB=pg` routes PostgreSQL access through `getPgPool()` /
 *   `queryWithTenant()` / `withPgTenant()`. Every PG query runs with RLS
 *   context (`SET LOCAL app.tenant_id`) inside an explicit transaction, so a
 *   query without a tenant fails closed instead of leaking across tenants.
 *
 * Tenant model: every tenant-scoped row carries `tenant_id` (see
 * `db/migrations/`). Pre-tenant local rows backfill to the explicit,
 * documented `DEFAULT_TENANT_ID` (`local-default`) — never a silent
 * cross-tenant merge. `local-default` must never appear in beta; beta callers
 * must pass an explicit tenant id per request (auth wiring is a later parcel).
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

/** Explicit documented backfill default for pre-tenant local rows. */
export const DEFAULT_TENANT_ID = "local-default";

export type DbProviderName = "sqlite" | "pg";

/**
 * Which database provider the process uses. Defaults to `sqlite`; only the
 * exact values `sqlite` and `pg` are accepted — anything else throws
 * fail-closed instead of guessing.
 */
export function getDbProvider(): DbProviderName {
  const raw = (process.env.MARKETOPS_DB ?? "sqlite").trim().toLowerCase();
  if (raw === "sqlite" || raw === "pg") return raw;
  throw new Error(
    `MARKETOPS_DB must be "sqlite" or "pg" (got ${JSON.stringify(process.env.MARKETOPS_DB)}). Refusing to guess a database provider.`
  );
}

/**
 * The documented default tenant for pre-tenant local rows. Overridable via
 * `MARKETOPS_DEFAULT_TENANT` for explicit local experiments only — never set
 * this to a real beta tenant id.
 */
export function getDefaultTenantId(): string {
  const value = (process.env.MARKETOPS_DEFAULT_TENANT ?? DEFAULT_TENANT_ID).trim();
  if (!value) {
    throw new Error("MARKETOPS_DEFAULT_TENANT is set but empty. Set a non-empty tenant id or unset it.");
  }
  return value;
}

/** Throw fail-closed unless `tenantId` is a non-empty tenant key. */
export function assertTenantId(tenantId: string): string {
  const value = (tenantId ?? "").trim();
  if (!value) {
    throw new Error("A non-empty tenant id is required. Refusing to run a tenant-scoped query without one.");
  }
  return value;
}

/**
 * Resolve the tenant for a SQLite/local operation: explicit argument first,
 * then `MARKETOPS_TENANT_ID`, then the documented local default. Beta PG code
 * paths must pass an explicit tenant id instead of relying on the fallback.
 */
export function resolveTenantId(explicit?: string | null): string {
  const candidate = explicit ?? process.env.MARKETOPS_TENANT_ID ?? getDefaultTenantId();
  return assertTenantId(candidate);
}

// ─────────────────────────────────────────────────────────────────────────────
// SQLite path — identical behaviour to the pre-parcel readiness/db.ts.
// ─────────────────────────────────────────────────────────────────────────────

const dataDir = path.join(process.cwd(), ".marketops");
const dbPath = path.join(dataDir, "marketops.sqlite");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

export { db, dbPath };

// ─────────────────────────────────────────────────────────────────────────────
// PostgreSQL path — `pg` Pool with mandatory RLS tenant context.
// ─────────────────────────────────────────────────────────────────────────────

let pool: Pool | null = null;

/**
 * Connection string for PG. `DATABASE_URL` wins; otherwise compose from
 * `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE`. Returns `undefined`
 * when nothing is configured so callers can fail closed with a clear message
 * instead of attempting a surprise connection. Secrets are never logged.
 */
export function getPgConnectionString(): string | undefined {
  const direct = (process.env.DATABASE_URL ?? "").trim();
  if (direct) return direct;
  const host = (process.env.PGHOST ?? "").trim();
  if (!host) return undefined;
  const port = (process.env.PGPORT ?? "5432").trim() || "5432";
  const user = encodeURIComponent((process.env.PGUSER ?? "marketops_app").trim() || "marketops_app");
  const password = process.env.PGPASSWORD ?? "";
  const database = encodeURIComponent((process.env.PGDATABASE ?? "marketops").trim() || "marketops");
  const auth = password ? `${user}:${encodeURIComponent(password)}` : user;
  return `postgres://${auth}@${host}:${port}/${database}`;
}

/** Lazy singleton Pool. Creating the Pool never connects — first query does. */
export function getPgPool(): Pool {
  if (pool) return pool;
  const connectionString = getPgConnectionString();
  if (!connectionString) {
    throw new Error(
      "MARKETOPS_DB=pg requires a PostgreSQL connection string (set DATABASE_URL, or PGHOST/PGPORT/PGUSER/PGDATABASE). " +
        "No live Azure database is required in this parcel; beta live verification is deferred to INT int-tenant-isolation."
    );
  }
  const sslDisabled = (process.env.PGSSLMODE ?? "").trim().toLowerCase() === "disable";
  pool = new Pool({
    connectionString,
    // Azure Flexible Server requires TLS; only explicit PGSSLMODE=disable
    // (local dockerised PG drills) turns verification off.
    ssl: sslDisabled ? undefined : { rejectUnauthorized: true },
    max: 10,
  });
  return pool;
}

/** Set the RLS tenant for the current transaction. Must run inside BEGIN. */
async function setRlsTenant(client: PoolClient, tenantId: string): Promise<void> {
  await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
}

/**
 * Run one PG statement with RLS context: BEGIN, SET LOCAL app.tenant_id,
 * statement, COMMIT (ROLLBACK on error). The tenant id must be non-empty —
 * there is no silent fallback.
 */
export async function queryWithTenant<T extends QueryResultRow = QueryResultRow>(
  tenantId: string,
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  const tenant = assertTenantId(tenantId);
  const client = await getPgPool().connect();
  try {
    await client.query("BEGIN");
    await setRlsTenant(client, tenant);
    const result = await client.query<T>(text, params as unknown[]);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Rollback best-effort; the original error is what matters.
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Run a multi-statement PG transaction with RLS context, for call sites that
 * need more than one statement per tenant scope.
 */
export async function withPgTenant<T>(tenantId: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const tenant = assertTenantId(tenantId);
  const client = await getPgPool().connect();
  try {
    await client.query("BEGIN");
    await setRlsTenant(client, tenant);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Rollback best-effort; the original error is what matters.
    }
    throw error;
  } finally {
    client.release();
  }
}

/** Close the singleton Pool (tests / graceful shutdown). */
export async function closePgPool(): Promise<void> {
  if (pool) {
    const current = pool;
    pool = null;
    await current.end();
  }
}
