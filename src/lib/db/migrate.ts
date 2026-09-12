/**
 * w1-postgres-rls-migrate — ordered, checksummed migration runner.
 *
 * - Migrations live in `db/migrations/` as `NNN_slug.sql`, applied in numeric
 *   order. Each file's sha256 is recorded in `schema_migrations` on apply.
 * - Re-runs verify every previously applied checksum against the file on
 *   disk and refuse on divergence (edited after apply) or on a missing file
 *   (applied version with no matching file). There are no DOWN migrations by
 *   design: beta rollback is a PITR restore (see the Azure runbook).
 * - The runner is executor-agnostic (`MigrationExecutor`) so ordering and
 *   divergence are unit-testable without a live database. Against real PG,
 *   pass a `pg` Client/Pool; each file's multi-statement SQL runs via a
 *   single `query()` call (simple-query protocol, no parameters).
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type MigrationFile = {
  version: string;
  name: string;
  fileName: string;
  filePath: string;
  sql: string;
  checksum: string;
};

export type AppliedMigration = {
  version: string;
  checksum: string;
};

export type MigrationExecutor = {
  query<T = { version: string; checksum: string }>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[] }>;
};

const MIGRATION_FILENAME_RE = /^(\d{3})_([a-z0-9][a-z0-9-]*)\.sql$/;

export function getMigrationsDir(): string {
  return path.join(process.cwd(), "db", "migrations");
}

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

/** Load and validate migration files in numeric order. Throws fail-closed. */
export function listMigrationFiles(dir: string = getMigrationsDir()): MigrationFile[] {
  if (!fs.existsSync(dir)) {
    throw new Error(`Migrations directory not found: ${dir}`);
  }
  const fileNames = fs
    .readdirSync(dir)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();
  if (fileNames.length === 0) {
    throw new Error(`No migration files found in ${dir}`);
  }
  const seen = new Set<string>();
  const files: MigrationFile[] = fileNames.map((fileName) => {
    const match = MIGRATION_FILENAME_RE.exec(fileName);
    if (!match) {
      throw new Error(`Invalid migration filename "${fileName}". Expected NNN_lowercase-slug.sql (e.g. 001_tenants-and-bookkeeping.sql).`);
    }
    const version = match[1];
    if (seen.has(version)) {
      throw new Error(`Duplicate migration version "${version}" (${fileName}). Versions must be unique.`);
    }
    seen.add(version);
    const filePath = path.join(dir, fileName);
    const sql = fs.readFileSync(filePath, "utf8");
    if (!sql.trim()) {
      throw new Error(`Migration "${fileName}" is empty. Refusing to record an empty migration.`);
    }
    return { version, name: match[2], fileName, filePath, sql, checksum: sha256Hex(sql) };
  });
  files.sort((a, b) => (a.version < b.version ? -1 : a.version > b.version ? 1 : 0));
  return files;
}

/**
 * Compare bookkeeping against files on disk. Returns pending files in order.
 * Throws on: applied version with no file, checksum mismatch (file edited
 * after apply), or an unapplied file below the highest applied version.
 */
export function planMigrations(
  applied: AppliedMigration[],
  files: MigrationFile[]
): { pending: MigrationFile[] } {
  const byVersion = new Map(files.map((file) => [file.version, file]));
  for (const row of applied) {
    const file = byVersion.get(row.version);
    if (!file) {
      throw new Error(
        `Applied migration "${row.version}" has no matching file in db/migrations. Refusing: a migration file may have been deleted or renamed.`
      );
    }
    if (file.checksum !== row.checksum) {
      throw new Error(
        `Checksum divergence on migration "${row.version}" (${file.fileName}): the file changed after it was applied. ` +
          `applied=${row.checksum} file=${file.checksum}. Refusing to continue.`
      );
    }
  }
  const appliedVersions = new Set(applied.map((row) => row.version));
  const maxApplied = applied.length > 0 ? [...appliedVersions].sort().pop()! : null;
  for (const file of files) {
    if (maxApplied !== null && file.version < maxApplied && !appliedVersions.has(file.version)) {
      throw new Error(
        `Migration "${file.version}" (${file.fileName}) sits below the highest applied version but was never applied. Refusing: apply order would be violated.`
      );
    }
  }
  return { pending: files.filter((file) => !appliedVersions.has(file.version)) };
}

export async function ensureMigrationsTable(executor: MigrationExecutor): Promise<void> {
  await executor.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);
}

export async function loadApplied(executor: MigrationExecutor): Promise<AppliedMigration[]> {
  const result = await executor.query<{ version: string; checksum: string }>(
    `SELECT version, checksum FROM schema_migrations ORDER BY version ASC`
  );
  return result.rows.map((row) => ({ version: row.version, checksum: row.checksum }));
}

/**
 * Apply pending migrations in order, recording file name + sha256 per file.
 * Divergence or missing files refuse before executing anything pending.
 */
export async function applyMigrations(
  executor: MigrationExecutor,
  dir: string = getMigrationsDir()
): Promise<{ applied: string[] }> {
  await ensureMigrationsTable(executor);
  const applied = await loadApplied(executor);
  const files = listMigrationFiles(dir);
  const { pending } = planMigrations(applied, files);
  const done: string[] = [];
  for (const file of pending) {
    await executor.query(file.sql);
    await executor.query(
      `INSERT INTO schema_migrations (version, file_name, checksum, applied_at) VALUES ($1, $2, $3, $4)`,
      [file.version, file.fileName, file.checksum, new Date().toISOString()]
    );
    done.push(file.version);
  }
  return { applied: done };
}
