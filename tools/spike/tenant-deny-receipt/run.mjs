// w0-spike-tenant-deny-receipt — thin vertical spike (harness only, no product code).
//
// Goal: prove the W0 contract abstractions hold for one end-to-end slice:
//   1. tenant-scoped write + read succeeds for the owning tenant (positive)
//   2. cross-tenant read is denied AND a denial receipt is recorded (negative)
//   3. null/expired session is denied AND a denial receipt is recorded (failure)
//   4. merged contract fixtures validate against merged contract schemas
//
// Design notes:
// - Temp SQLite DB under os.tmpdir(); NEVER touches .marketops/* or prod data.
// - Denial receipt shape mirrors contracts/GateResult.json denial fields
//   (denialCode / denialMessage) so W1 can promote it to a real receipt.
// - Requires dev dependencies present (better-sqlite3, ajv); install with:
//     npm install --no-save --no-package-lock --no-audit --no-fund
// - If any abstraction here feels wrong, STOP: file a contract amendment.
//   Do not "fix forward" into src/ from this parcel.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import Ajv from "ajv";
import Database from "better-sqlite3";

const ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const ajv = new Ajv({ allErrors: true });

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function assert(cond, message) {
  if (!cond) {
    console.error(`SPIKE-FAIL ${message}`);
    process.exitCode = 1;
    throw new Error(message);
  }
  console.log(`SPIKE-OK ${message}`);
}

// Tenant guard: the single abstraction W1 must implement for real (S1/S2).
// Returns { ok: true } or a denial receipt (fail-closed: never throws open).
function guard(sessionTenantId, rowTenantId, action) {
  if (typeof sessionTenantId !== "string" || sessionTenantId.length === 0) {
    return {
      receiptId: `den-${Date.now()}-nosession`,
      tenantId: rowTenantId,
      requestedTenantId: null,
      denialCode: "UNAUTHENTICATED",
      denialMessage: `${action} denied: no authenticated tenant`,
      decidedAtUtc: new Date().toISOString(),
    };
  }
  if (sessionTenantId !== rowTenantId) {
    return {
      receiptId: `den-${Date.now()}-mismatch`,
      tenantId: rowTenantId,
      requestedTenantId: sessionTenantId,
      denialCode: "TENANT_MISMATCH",
      denialMessage: `${action} denied: tenant ${sessionTenantId} cannot access ${rowTenantId} data`,
      decidedAtUtc: new Date().toISOString(),
    };
  }
  return { ok: true };
}

function main() {
  // 0. Merged contracts + fixtures validate (abstraction input check).
  const betaTenantSchema = loadJson("contracts/BetaTenant.json");
  const entitlementSchema = loadJson("contracts/Entitlement.json");
  const tenants = loadJson("tests/contracts/fixtures/tenants.json");
  const entitlements = loadJson("tests/contracts/fixtures/entitlements.json");
  assert(tenants.length === 2, "two roster tenants load from fixtures");
  for (const t of tenants) assert(ajv.validate(betaTenantSchema, t), `tenant ${t.tenantId} satisfies BetaTenant`);
  for (const e of entitlements) assert(ajv.validate(entitlementSchema, e), `entitlement ${e.tenantId} satisfies Entitlement`);

  const [keon, biostack] = tenants.map((t) => t.tenantId);

  // Temp DB only.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "marketops-spike-"));
  const dbPath = path.join(dir, "spike.sqlite");
  assert(!dbPath.includes("marketops.sqlite") && !dbPath.startsWith(ROOT), `spike DB is temp-only (${dbPath})`);
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE spike_items (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, payload TEXT NOT NULL);
    CREATE TABLE spike_denials (receipt_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
      requested_tenant_id TEXT, denial_code TEXT NOT NULL, denial_message TEXT NOT NULL,
      decided_at_utc TEXT NOT NULL);
  `);
  const recordDenial = db.prepare(
    "INSERT INTO spike_denials VALUES (@receiptId, @tenantId, @requestedTenantId, @denialCode, @denialMessage, @decidedAtUtc)"
  );

  // 1. Positive: tenant-scoped write + read.
  db.prepare("INSERT INTO spike_items VALUES (?, ?, ?)").run("item-1", keon, "keon draft");
  const readOwn = guard(keon, keon, "read");
  assert(readOwn.ok === true, "own-tenant guard passes");
  const row = db.prepare("SELECT payload FROM spike_items WHERE id = ? AND tenant_id = ?").get("item-1", keon);
  assert(row && row.payload === "keon draft", "tenant-scoped write reads back for owner");

  // 2. Negative: cross-tenant read denied + receipt recorded.
  const deny = guard(biostack, keon, "read");
  assert(!deny.ok && deny.denialCode === "TENANT_MISMATCH", "cross-tenant guard denies with TENANT_MISMATCH");
  recordDenial.run(deny);
  const leaked = db.prepare("SELECT * FROM spike_items WHERE id = ? AND tenant_id = ?").get("item-1", biostack);
  assert(leaked === undefined, "tenant-scoped query leaks zero rows across tenants");

  // 3. Failure: null session denied + receipt recorded.
  const denyNull = guard(null, keon, "write");
  assert(!denyNull.ok && denyNull.denialCode === "UNAUTHENTICATED", "null session guard denies with UNAUTHENTICATED");
  recordDenial.run(denyNull);

  // 4. Receipt verification: every denial left a complete receipt.
  const receipts = db.prepare("SELECT * FROM spike_denials").all();
  assert(receipts.length === 2, "two denial receipts recorded");
  for (const r of receipts) {
    assert(r.denial_code && r.denial_message && r.decided_at_utc, `receipt ${r.receipt_id} is complete`);
  }

  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log("SPIKE-OK temp DB destroyed, repo untouched");
  console.log("SPIKE-RESULT pass: tenant write + cross-tenant deny + denial receipts verified");
}

main();
