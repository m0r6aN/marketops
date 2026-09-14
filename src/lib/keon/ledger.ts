// ---------------------------------------------------------------------------
// k2-cortex-mirror — S11 local-first hash-chained receipt mirror (ingestion).
//
// Doctrine (binding, do not relitigate): chain-over-collection (unlinked
// receipts are NOT a ledger); append-only (corrections = new entries);
// LedgerEntry contract fields (contracts/LedgerEntry.json + LedgerEntry in
// keon/types.ts); entries derive from receipts, never authorize (ingestion
// never validates the underlying decision — no policy evaluation happens
// here); canonical vocabulary only; deterministic canonical JSON (sorted
// keys, SHA-256, NO wall-clock inside hashed fields — timestamps alongside);
// d-chain-reconstruction (local chain verifies standalone; epoch anchoring
// composes additively, never rewrites history).
//
// Hash construction (documented once, here):
// - Hashed (governed) fields: seq, prevHash, receiptRef, correlationId,
//   tenantId, receiptClass, actorId, timestamp (= decidedAtUtc, the governed
//   effect time supplied by the caller — NOT sampled here).
// - Alongside (stored, NEVER hashed): recordedAtUtc (local wall-clock) and
//   epochRef (set later by closeEpoch(); excluded so anchoring never rehashes
//   history). entryHash itself is the output, never an input.
// - canonicalEntryBytes() = JSON.stringify of the governed fields with keys
//   sorted recursively, no whitespace. entryHash = "sha256:" + hex(sha256(
//   canonicalEntryBytes)). verifyChain() recomputes every entryHash from
//   stored governed fields and refuses on ANY gap/mismatch/tamper.
// - Genesis: the seq-0 entry's prevHash MUST be LEDGER_GENESIS_PREV_HASH
//   ("sha256:genesis"); every later entry's prevHash MUST equal its
//   predecessor's entryHash (anti-fork).
//
// Receipt refs: required, MUST be a URI (scheme://...). keon://receipt/{id}
// when Keon-anchored; a distinct local scheme such as
// marketops://unanchored-receipt/{id} for unanchored provenance rows (never
// keon://, never a bare id — bare ids are rejected fail-closed).
//
// Receipt classes: family.subject.action per KEON_RECEIPT_CLASS_PATTERN.
// legacy.unclassified is accepted for backfilled rows only — appends here
// reject it (new code never issues it).
//
// No clients, no transport, no network calls. No new dependencies.
// ---------------------------------------------------------------------------

import { createHash } from "node:crypto";

import "@/lib/keon/db";
import { db } from "@/lib/keon/db";
import { resolveTenantId } from "@/lib/db/provider";
import {
  KEON_RECEIPT_CLASS_PATTERN,
  LEDGER_GENESIS_PREV_HASH,
  type LedgerEntry,
} from "@/lib/keon/types";

// -- Errors ------------------------------------------------------------------

export type LedgerErrorCode =
  | "LEDGER_INVALID_RECEIPT_REF"
  | "LEDGER_INVALID_INPUT"
  | "LEDGER_TENANT_MISMATCH"
  | "LEDGER_CHAIN_GAP"
  | "LEDGER_TAMPER_DETECTED"
  | "LEDGER_APPEND_CONFLICT";

/** Fail-closed ingestion/verification refusal for the ledger mirror. */
export class LedgerError extends Error {
  readonly code: LedgerErrorCode;

  constructor(code: LedgerErrorCode, message: string) {
    super(message);
    this.name = "LedgerError";
    this.code = code;
  }
}

function failClosed(code: LedgerErrorCode, message: string): never {
  throw new LedgerError(code, message);
}

// -- Canonical JSON + hashing -------------------------------------------------

const ENTRY_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const PREV_HASH_PATTERN = /^(sha256:[a-f0-9]{64}|sha256:genesis)$/;
const RECEIPT_REF_PATTERN = /^[a-z][a-z0-9+.-]*:\/\/\S+$/;
const RECEIPT_CLASS_RE = new RegExp(KEON_RECEIPT_CLASS_PATTERN);

/** Local unanchored receipt scheme (distinct from keon://, never a bare id). */
export const LEDGER_UNANCHORED_RECEIPT_SCHEME = "marketops://unanchored-receipt/";

/** Receipt class issued for local mirror rows (see PR open decisions). */
export const LEDGER_MIRROR_RECEIPT_CLASS = "ledger.entry.appended";

/** Actor marking mirror provenance (recorder, never authority). */
export const LEDGER_MIRROR_ACTOR_ID = "system:ledger-mirror";

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deterministic canonical JSON: object keys sorted recursively at every
 * level, arrays order-preserved, no whitespace. ethicalRisk: none — pure
 * byte layout for hashing; wall-clock values must never be passed in.
 */
export function toCanonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => toCanonicalJson(entry)).join(",")}]`;
  }
  if (isRecord(value)) {
    const keys = Object.keys(value).sort();
    const body = keys
      .map((key) => `${JSON.stringify(key)}:${toCanonicalJson(value[key])}`)
      .join(",");
    return `{${body}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** Governed (hashed) fields of a ledger entry — see the module header. */
export type LedgerGovernedFields = {
  seq: number;
  prevHash: string;
  receiptRef: string;
  correlationId: string;
  tenantId: string;
  receiptClass: string;
  actorId: string;
  timestamp: string;
};

/** Canonical entry bytes: sorted-key JSON of the governed fields + prevHash. */
export function canonicalEntryBytes(fields: LedgerGovernedFields): string {
  return toCanonicalJson({
    actorId: fields.actorId,
    correlationId: fields.correlationId,
    prevHash: fields.prevHash,
    receiptClass: fields.receiptClass,
    receiptRef: fields.receiptRef,
    seq: fields.seq,
    tenantId: fields.tenantId,
    timestamp: fields.timestamp,
  });
}

/** Chain hash for governed fields in sha256:<hex> form. */
export function computeEntryHash(fields: LedgerGovernedFields): string {
  return `sha256:${sha256Hex(canonicalEntryBytes(fields))}`;
}

// -- Row mapping ---------------------------------------------------------------

type LedgerEntryRow = {
  entry_hash: string;
  tenant_id: string;
  seq: number;
  prev_hash: string;
  receipt_ref: string;
  receipt_class: string;
  actor_id: string;
  correlation_id: string;
  epoch_ref: string | null;
  decided_at_utc: string;
  recorded_at_utc: string;
};

function mapRow(row: LedgerEntryRow): LedgerEntry {
  return {
    seq: row.seq,
    prevHash: row.prev_hash,
    receiptRef: row.receipt_ref,
    correlationId: row.correlation_id,
    entryHash: row.entry_hash,
    epochRef: row.epoch_ref,
    tenantId: row.tenant_id,
    receiptClass: row.receipt_class,
    actorId: row.actor_id,
    timestamp: row.decided_at_utc,
  };
}

/** Alongside (non-hashed) storage metadata for a ledger entry. */
export type LedgerEntryMeta = {
  recordedAtUtc: string;
};

// -- Validation (ingestion derives, never authorizes) ---------------------------

function assertReceiptRef(receiptRef: unknown): string {
  if (!isNonEmpty(receiptRef)) {
    failClosed(
      "LEDGER_INVALID_RECEIPT_REF",
      "Ledger append requires a receiptRef (unlinked receipts are NOT a ledger). Failing closed.",
    );
  }
  if (!RECEIPT_REF_PATTERN.test(receiptRef)) {
    failClosed(
      "LEDGER_INVALID_RECEIPT_REF",
      `Ledger receiptRef must be a URI (keon://receipt/{id} when anchored, or a distinct local scheme such as marketops://unanchored-receipt/{id} — never a bare id). Got ${JSON.stringify(receiptRef)}. Failing closed.`,
    );
  }
  return receiptRef;
}

function assertAppendInput(input: {
  receiptRef: unknown;
  correlationId: unknown;
  tenantId: unknown;
  receiptClass: unknown;
  actorId: unknown;
  decidedAtUtc: unknown;
}): {
  receiptRef: string;
  correlationId: string;
  tenantId: string;
  receiptClass: string;
  actorId: string;
  decidedAtUtc: string;
} {
  const receiptRef = assertReceiptRef(input.receiptRef);
  if (!isNonEmpty(input.correlationId)) {
    failClosed("LEDGER_INVALID_INPUT", "Ledger append requires a non-empty correlationId. Failing closed.");
  }
  if (!isNonEmpty(input.tenantId)) {
    failClosed("LEDGER_INVALID_INPUT", "Ledger append requires a non-empty tenantId (multi-tenant chains are forbidden). Failing closed.");
  }
  if (!isNonEmpty(input.receiptClass) || !RECEIPT_CLASS_RE.test(input.receiptClass)) {
    failClosed(
      "LEDGER_INVALID_INPUT",
      `Ledger receiptClass must be family.subject.action (got ${JSON.stringify(input.receiptClass)}). Failing closed.`,
    );
  }
  if (input.receiptClass === "legacy.unclassified") {
    failClosed(
      "LEDGER_INVALID_INPUT",
      "legacy.unclassified is accepted for backfilled rows only and is never issued by new code. Failing closed.",
    );
  }
  if (!isNonEmpty(input.actorId)) {
    failClosed("LEDGER_INVALID_INPUT", "Ledger append requires a non-empty actorId (user:{guid} or system:{component}). Failing closed.");
  }
  if (!isNonEmpty(input.decidedAtUtc) || Number.isNaN(Date.parse(input.decidedAtUtc))) {
    failClosed(
      "LEDGER_INVALID_INPUT",
      "Ledger append requires a valid ISO-8601 decidedAtUtc governed effect time. Failing closed.",
    );
  }
  return {
    receiptRef,
    correlationId: input.correlationId,
    tenantId: input.tenantId,
    receiptClass: input.receiptClass,
    actorId: input.actorId,
    decidedAtUtc: input.decidedAtUtc,
  };
}

// -- Append ---------------------------------------------------------------------

export type AppendLedgerEntryInput = {
  receiptRef: string;
  correlationId: string;
  tenantId: string;
  receiptClass: string;
  actorId: string;
  /** Governed effect time (contract timestamp). Hashed — caller-supplied, never sampled here. */
  decidedAtUtc: string;
};

/**
 * Append one hash-chained ledger entry for a decision receipt. Computes the
 * canonical entry bytes (sorted-key JSON of governed fields + prevHash),
 * derives entryHash via SHA-256, and enforces prevHash continuity (genesis
 * constant at seq 0), receiptRef presence, and tenant match against the
 * chain head. Ingestion never validates the underlying decision — entries
 * derive from receipts, never authorize.
 *
 * recordedAtUtc is sampled alongside (never hashed). Throws LedgerError
 * fail-closed on any violation; callers on the safety path must use
 * tryMirrorClaimDecisionReceipt() so a mirror failure degrades visibly
 * without blocking the safety decision.
 */
export function appendLedgerEntry(input: AppendLedgerEntryInput): LedgerEntry {
  const cleaned = assertAppendInput(input);
  const head = db
    .prepare(`SELECT seq, entry_hash AS entry_hash, tenant_id FROM ledger_entries WHERE tenant_id = ? ORDER BY seq DESC LIMIT 1`)
    .get(cleaned.tenantId) as { seq: number; entry_hash: string; tenant_id: string } | undefined;

  const seq = head ? head.seq + 1 : 0;
  const prevHash = head ? head.entry_hash : LEDGER_GENESIS_PREV_HASH;
  if (!PREV_HASH_PATTERN.test(prevHash)) {
    failClosed("LEDGER_TAMPER_DETECTED", "Chain head carries a malformed prevHash/entryHash. Failing closed.");
  }
  const governed: LedgerGovernedFields = {
    seq,
    prevHash,
    receiptRef: cleaned.receiptRef,
    correlationId: cleaned.correlationId,
    tenantId: cleaned.tenantId,
    receiptClass: cleaned.receiptClass,
    actorId: cleaned.actorId,
    timestamp: cleaned.decidedAtUtc,
  };
  const entryHash = computeEntryHash(governed);
  const recordedAtUtc = new Date().toISOString();
  try {
    db.prepare(
      `INSERT INTO ledger_entries
        (entry_hash, tenant_id, seq, prev_hash, receipt_ref, receipt_class,
         actor_id, correlation_id, epoch_ref, decided_at_utc, recorded_at_utc)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    ).run(
      entryHash,
      cleaned.tenantId,
      seq,
      prevHash,
      cleaned.receiptRef,
      cleaned.receiptClass,
      cleaned.actorId,
      cleaned.correlationId,
      cleaned.decidedAtUtc,
      recordedAtUtc,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failClosed("LEDGER_APPEND_CONFLICT", `Ledger append refused (possible concurrent append or duplicate entry): ${message}. Failing closed.`);
  }
  return getLedgerEntryByHash(entryHash)!;
}

// -- Verification (d-chain-reconstruction: standalone, no epoch trust) ------------

export type VerifyChainResult = {
  tenantId: string;
  count: number;
  headHash: string | null;
};

/**
 * Recompute-walk the tenant's chain from genesis: every entryHash is
 * recomputed from stored governed fields, every prevHash must equal its
 * predecessor's entryHash (genesis constant at seq 0), seqs must be dense
 * from 0, and every row must carry the same tenantId. epochRef values are
 * accepted as-is (null or set) — epoch anchoring composes additively and
 * never affects chain validity. Throws LedgerError fail-closed on ANY
 * gap/mismatch/tamper — never skips.
 */
export function verifyChain(tenantId: string): VerifyChainResult {
  const tenant = assertTenantId(tenantId);
  const rows = db
    .prepare(`SELECT * FROM ledger_entries WHERE tenant_id = ? ORDER BY seq ASC`)
    .all(tenant) as LedgerEntryRow[];
  let expectedPrev = LEDGER_GENESIS_PREV_HASH;
  let expectedSeq = 0;
  for (const row of rows) {
    if (row.tenant_id !== tenant) {
      failClosed("LEDGER_TENANT_MISMATCH", `Chain row seq ${row.seq} carries tenant ${JSON.stringify(row.tenant_id)} inside tenant ${JSON.stringify(tenant)}'s chain. Failing closed.`);
    }
    if (row.seq !== expectedSeq) {
      failClosed(
        "LEDGER_CHAIN_GAP",
        `Chain gap: expected seq ${expectedSeq}, found seq ${row.seq}. Missing entries are never skipped. Failing closed.`,
      );
    }
    if (row.prev_hash !== expectedPrev) {
      failClosed(
        "LEDGER_CHAIN_GAP",
        `Chain continuity break at seq ${row.seq}: prevHash does not equal the predecessor entryHash (reordered or gapped chain). Failing closed.`,
      );
    }
    if (!isNonEmpty(row.receipt_ref) || !RECEIPT_REF_PATTERN.test(row.receipt_ref)) {
      failClosed("LEDGER_INVALID_RECEIPT_REF", `Chain row seq ${row.seq} carries no valid receiptRef (unlinked receipts are NOT a ledger). Failing closed.`);
    }
    const recomputed = computeEntryHash({
      seq: row.seq,
      prevHash: row.prev_hash,
      receiptRef: row.receipt_ref,
      correlationId: row.correlation_id,
      tenantId: row.tenant_id,
      receiptClass: row.receipt_class,
      actorId: row.actor_id,
      timestamp: row.decided_at_utc,
    });
    if (recomputed !== row.entry_hash || !ENTRY_HASH_PATTERN.test(row.entry_hash)) {
      failClosed(
        "LEDGER_TAMPER_DETECTED",
        `Tamper detected at seq ${row.seq}: stored entryHash does not recompute from governed fields. Failing closed.`,
      );
    }
    expectedPrev = row.entry_hash;
    expectedSeq += 1;
  }
  return { tenantId: tenant, count: rows.length, headHash: rows.length > 0 ? rows[rows.length - 1].entry_hash : null };
}

function assertTenantId(tenantId: unknown): string {
  if (!isNonEmpty(tenantId)) {
    failClosed("LEDGER_INVALID_INPUT", "Ledger operations require a non-empty tenantId. Failing closed.");
  }
  return tenantId;
}

// -- Read-only queries ------------------------------------------------------------

export function getLedgerEntryByHash(entryHash: string): LedgerEntry | undefined {
  const row = db.prepare(`SELECT * FROM ledger_entries WHERE entry_hash = ?`).get(entryHash) as LedgerEntryRow | undefined;
  return row ? mapRow(row) : undefined;
}

export function getLedgerEntryMeta(entryHash: string): LedgerEntryMeta | undefined {
  const row = db.prepare(`SELECT recorded_at_utc FROM ledger_entries WHERE entry_hash = ?`).get(entryHash) as
    | { recorded_at_utc: string }
    | undefined;
  return row ? { recordedAtUtc: row.recorded_at_utc } : undefined;
}

export function listLedgerEntries(tenantId: string): LedgerEntry[] {
  const tenant = assertTenantId(tenantId);
  return (db.prepare(`SELECT * FROM ledger_entries WHERE tenant_id = ? ORDER BY seq ASC`).all(tenant) as LedgerEntryRow[]).map(mapRow);
}

export function findLedgerEntriesByReceiptRef(receiptRef: string): LedgerEntry[] {
  if (!isNonEmpty(receiptRef)) return [];
  return (db.prepare(`SELECT * FROM ledger_entries WHERE receipt_ref = ? ORDER BY seq ASC`).all(receiptRef) as LedgerEntryRow[]).map(mapRow);
}

export function findLedgerEntriesByCorrelationId(correlationId: string): LedgerEntry[] {
  if (!isNonEmpty(correlationId)) return [];
  return (db.prepare(`SELECT * FROM ledger_entries WHERE correlation_id = ? ORDER BY seq ASC`).all(correlationId) as LedgerEntryRow[]).map(mapRow);
}

// -- Mirror hook (safety-path entry point: never throws) -----------------------------

export type MirrorClaimReceiptInput = {
  /** Claim decision receipt id (becomes marketops://unanchored-receipt/{id}). */
  receiptId: string;
  reviewId: string;
  contentVersionId: string;
  /** Receipt created_at: the governed effect time (hashed as timestamp). */
  createdAt: string;
  /** Explicit tenant override; defaults to resolveTenantId() (S11-live wires the session tenant). */
  tenantId?: string;
};

export type MirrorOutcome =
  | { status: "appended"; entry: LedgerEntry }
  | { status: "unappended"; reason: string };

/**
 * Mirror hook for the claim decision receipt write path (ONE call site:
 * recordClaimDecisionReceipt in persuasion-review/repository.ts). Derives a
 * local unanchored mirror entry from the persisted receipt — claim receipts
 * are unanchored provenance rows, so receiptRef uses the distinct local
 * scheme (never keon://). NEVER throws into the decision path: append
 * failure yields an explicit { status: "unappended", reason } outcome that
 * the call site records as a visible review event (visible degradation,
 * never silent, never blocking safety). Chain gaps therefore break
 * verifiability loudly (verifyChain refuses) instead of silently.
 */
export function tryMirrorClaimDecisionReceipt(input: MirrorClaimReceiptInput): MirrorOutcome {
  try {
    if (!isNonEmpty(input.receiptId)) {
      return { status: "unappended", reason: "mirror skipped: empty receipt id" };
    }
    if (!isNonEmpty(input.createdAt) || Number.isNaN(Date.parse(input.createdAt))) {
      return { status: "unappended", reason: "mirror skipped: receipt created_at is missing or invalid" };
    }
    const tenantId = isNonEmpty(input.tenantId) ? input.tenantId : resolveTenantId();
    const entry = appendLedgerEntry({
      receiptRef: `${LEDGER_UNANCHORED_RECEIPT_SCHEME}${input.receiptId}`,
      correlationId: `claim-decision:${input.receiptId}`,
      tenantId,
      receiptClass: LEDGER_MIRROR_RECEIPT_CLASS,
      actorId: LEDGER_MIRROR_ACTOR_ID,
      decidedAtUtc: input.createdAt,
    });
    return { status: "appended", entry };
  } catch (error) {
    const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    try {
      console.warn(`[k2-cortex-mirror] ledger mirror UNAPPENDED (review ${input.reviewId}, receipt ${input.receiptId}): ${reason}`);
    } catch {
      // Logging is best-effort; the Unappended status itself is the signal.
    }
    return { status: "unappended", reason };
  }
}
