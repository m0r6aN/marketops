// ---------------------------------------------------------------------------
// k2-cortex-mirror — S11 epoch anchoring over the local hash chain.
//
// Doctrine (binding, do not relitigate): append-only (corrections = new
// entries); d-chain-reconstruction (local chain verifies standalone; epoch
// anchoring composes additively, never rewrites history).
//
// Model: closeEpoch() seals every currently unanchored entry
// (epoch_ref IS NULL) of one tenant into an append-only epoch record
// {epochId, rootHash, entryRange, closedAtUtc}. root = "sha256:" + hex(
// sha256(canonicalJson(orderedEntryHashes))) where orderedEntryHashes are the
// member entryHash values in seq order since the last epoch. Closing sets
// epoch_ref on the member rows — epoch_ref is EXCLUDED from entryHash (see
// ledger.ts), so anchoring never rehashes history and verifyChain() passes
// unchanged before and after a close.
//
// Inclusion proofs recompute: verifyEntryInEpoch() reloads the member rows,
// recomputes the root from live store bytes, and compares against the stored
// epoch rootHash — no store trust (a stored root is never believed without
// recompute). Unknown epochs and recompute mismatches fail closed.
//
// Epochs partition the chain: each close consumes exactly the unanchored
// suffix, so ranges never overlap and history is never re-anchored. Closing
// an empty suffix fails closed (an empty anchor would prove nothing).
//
// No live Cortex calls. No new dependencies.
// ---------------------------------------------------------------------------

import "@/lib/keon/db";
import { db } from "@/lib/keon/db";
import { computeEntryHash, toCanonicalJson, verifyChain } from "@/lib/keon/ledger";
import { createHash } from "node:crypto";

// -- Errors ------------------------------------------------------------------

export type EpochErrorCode =
  | "EPOCH_INVALID_INPUT"
  | "EPOCH_NOTHING_TO_ANCHOR"
  | "EPOCH_UNKNOWN"
  | "EPOCH_INCLUSION_FAILED";

/** Fail-closed epoch refusal. */
export class EpochError extends Error {
  readonly code: EpochErrorCode;

  constructor(code: EpochErrorCode, message: string) {
    super(message);
    this.name = "EpochError";
    this.code = code;
  }
}

function failClosed(code: EpochErrorCode, message: string): never {
  throw new EpochError(code, message);
}

// -- Types ---------------------------------------------------------------------

export type EpochEntryRange = {
  startSeq: number;
  endSeq: number;
  count: number;
};

export type EpochRecord = {
  epochId: string;
  tenantId: string;
  rootHash: string;
  entryRange: EpochEntryRange;
  closedAtUtc: string;
};

type EpochRow = {
  epoch_id: string;
  tenant_id: string;
  root_hash: string;
  start_seq: number;
  end_seq: number;
  entry_count: number;
  closed_at_utc: string;
};

type MemberRow = {
  seq: number;
  entry_hash: string;
  prev_hash: string;
  receipt_ref: string;
  receipt_class: string;
  actor_id: string;
  correlation_id: string;
  tenant_id: string;
  decided_at_utc: string;
};

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function mapEpochRow(row: EpochRow): EpochRecord {
  return {
    epochId: row.epoch_id,
    tenantId: row.tenant_id,
    rootHash: row.root_hash,
    entryRange: { startSeq: row.start_seq, endSeq: row.end_seq, count: row.entry_count },
    closedAtUtc: row.closed_at_utc,
  };
}

/**
 * Epoch root over ordered member entry hashes (seq order). The array order
 * IS the commitment — canonical JSON preserves array order while sorting
 * object keys, so reorderings recompute to a different root.
 */
export function computeEpochRoot(entryHashesInSeqOrder: string[]): string {
  return `sha256:${sha256Hex(toCanonicalJson(entryHashesInSeqOrder))}`;
}

/** Deterministic epoch id: epoch:{tenant}:{startSeq}-{endSeq} (no randomness). */
export function epochIdFor(tenantId: string, startSeq: number, endSeq: number): string {
  return `epoch:${tenantId}:${startSeq}-${endSeq}`;
}

// -- Close -----------------------------------------------------------------------

/**
 * Seal the tenant's currently unanchored suffix into a new epoch. Fails
 * closed when there is nothing to anchor. The update (set epoch_ref on
 * members) and the epoch insert run in one transaction so an epoch never
 * references a partially anchored range. Member entryHash values are never
 * touched — history is never rehashed.
 */
export function closeEpoch(input: { tenantId: string; closedAtUtc?: string }): EpochRecord {
  if (!isNonEmpty(input.tenantId)) {
    failClosed("EPOCH_INVALID_INPUT", "Epoch close requires a non-empty tenantId. Failing closed.");
  }
  const tenantId = input.tenantId;
  const closedAtUtc = input.closedAtUtc ?? new Date().toISOString();
  if (!isNonEmpty(closedAtUtc) || Number.isNaN(Date.parse(closedAtUtc))) {
    failClosed("EPOCH_INVALID_INPUT", "Epoch close requires a valid ISO-8601 closedAtUtc. Failing closed.");
  }
  // The chain must verify standalone BEFORE anchoring composes on top of it.
  verifyChain(tenantId);

  const members = db
    .prepare(`SELECT seq, entry_hash, prev_hash, receipt_ref, receipt_class, actor_id, correlation_id, tenant_id, decided_at_utc FROM ledger_entries WHERE tenant_id = ? AND epoch_ref IS NULL ORDER BY seq ASC`)
    .all(tenantId) as MemberRow[];
  if (members.length === 0) {
    failClosed("EPOCH_NOTHING_TO_ANCHOR", `No unanchored ledger entries for tenant ${JSON.stringify(tenantId)}; refusing to seal an empty epoch. Failing closed.`);
  }
  // Defensive: the suffix must be dense from the first unanchored seq (a gap
  // here means verifyChain passed on rows this query cannot see — refuse).
  for (let index = 1; index < members.length; index += 1) {
    if (members[index].seq !== members[index - 1].seq + 1) {
      failClosed("EPOCH_INVALID_INPUT", `Unanchored suffix is not dense at seq ${members[index].seq}. Failing closed.`);
    }
  }
  const hashes = members.map((member) => member.entry_hash);
  const rootHash = computeEpochRoot(hashes);
  const startSeq = members[0].seq;
  const endSeq = members[members.length - 1].seq;
  const epochId = epochIdFor(tenantId, startSeq, endSeq);

  db.transaction(() => {
    for (const member of members) {
      db.prepare(`UPDATE ledger_entries SET epoch_ref = ? WHERE entry_hash = ? AND tenant_id = ?`).run(
        epochId,
        member.entry_hash,
        tenantId,
      );
    }
    db.prepare(
      `INSERT INTO ledger_epochs
        (epoch_id, tenant_id, root_hash, start_seq, end_seq, entry_count, closed_at_utc)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(epochId, tenantId, rootHash, startSeq, endSeq, members.length, closedAtUtc);
  })();
  return getEpoch(epochId)!;
}

// -- Reads ------------------------------------------------------------------------

export function getEpoch(epochId: string): EpochRecord | undefined {
  if (!isNonEmpty(epochId)) return undefined;
  const row = db.prepare(`SELECT * FROM ledger_epochs WHERE epoch_id = ?`).get(epochId) as EpochRow | undefined;
  return row ? mapEpochRow(row) : undefined;
}

export function listEpochs(tenantId: string): EpochRecord[] {
  if (!isNonEmpty(tenantId)) return [];
  return (db.prepare(`SELECT * FROM ledger_epochs WHERE tenant_id = ? ORDER BY start_seq ASC`).all(tenantId) as EpochRow[]).map(mapEpochRow);
}

// -- Inclusion (recompute path — no store trust) -------------------------------------

export type EpochInclusionResult = {
  included: boolean;
  epochId: string;
  recomputedRoot: string;
  storedRoot: string;
};

/**
 * Prove (or refuse) that an entry hash belongs to an epoch by RECOMPUTING
 * the epoch root from the live member rows and comparing to the stored root.
 * Returns included=false when the entry is outside the epoch range or the
 * recompute mismatches; throws EpochError only for unknown epochs or
 * malformed input. The stored root is never trusted without recompute, and
 * each member's entryHash is itself re-derived from governed fields so a
 * tampered row breaks inclusion even when the stored hashes look consistent.
 */
export function verifyEntryInEpoch(entryHash: string, epochId: string): EpochInclusionResult {
  if (!isNonEmpty(entryHash) || !isNonEmpty(epochId)) {
    failClosed("EPOCH_INVALID_INPUT", "Epoch inclusion requires a non-empty entryHash and epochId. Failing closed.");
  }
  const epoch = getEpoch(epochId);
  if (!epoch) {
    failClosed("EPOCH_UNKNOWN", `Unknown epoch ${JSON.stringify(epochId)}. Failing closed.`);
  }
  const members = db
    .prepare(`SELECT seq, entry_hash, prev_hash, receipt_ref, receipt_class, actor_id, correlation_id, tenant_id, decided_at_utc FROM ledger_entries WHERE tenant_id = ? AND epoch_ref = ? ORDER BY seq ASC`)
    .all(epoch.tenantId, epochId) as MemberRow[];
  // Re-derive every member hash from governed fields (no trust in stored bytes).
  const liveHashes: string[] = [];
  for (const member of members) {
    const recomputed = computeEntryHash({
      seq: member.seq,
      prevHash: member.prev_hash,
      receiptRef: member.receipt_ref,
      correlationId: member.correlation_id,
      tenantId: member.tenant_id,
      receiptClass: member.receipt_class,
      actorId: member.actor_id,
      timestamp: member.decided_at_utc,
    });
    if (recomputed !== member.entry_hash) {
      return { included: false, epochId, recomputedRoot: computeEpochRoot(liveHashes.concat(`tamper-at-seq-${member.seq}`)), storedRoot: epoch.rootHash };
    }
    liveHashes.push(member.entry_hash);
  }
  const recomputedRoot = computeEpochRoot(liveHashes);
  if (recomputedRoot !== epoch.rootHash) {
    return { included: false, epochId, recomputedRoot, storedRoot: epoch.rootHash };
  }
  return { included: liveHashes.includes(entryHash), epochId, recomputedRoot, storedRoot: epoch.rootHash };
}

/**
 * Strict variant: throws EPOCH_INCLUSION_FAILED unless the entry is proven
 * included by recompute. Use on paths where a missing proof must refuse.
 */
export function requireEntryInEpoch(entryHash: string, epochId: string): EpochInclusionResult {
  const result = verifyEntryInEpoch(entryHash, epochId);
  if (!result.included) {
    failClosed(
      "EPOCH_INCLUSION_FAILED",
      `Entry ${entryHash} is NOT proven in epoch ${epochId} (recomputedRoot=${result.recomputedRoot} storedRoot=${result.storedRoot}). Failing closed.`,
    );
  }
  return result;
}
