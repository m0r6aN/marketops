// ---------------------------------------------------------------------------
// k2-cortex-mirror — S11 proof-bundle composition over the local mirror.
//
// Doctrine (binding, do not relitigate): append-only; d-chain-reconstruction
// (local chain verifies standalone; epoch anchoring composes additively).
//
// A proof bundle is a self-describing manifest over ledger artifacts:
// { bundleId, version, epochId, artifacts[] (per-artifact sha256),
//   commands/env pins, composedAtUtc }. Per the Cortex convention the
// bundleId EQUALS the epoch rootHash it seals (bundleId-equals-root): for an
// epoch bundle the artifacts are the epoch's member canonical entry bytes
// plus the canonical epoch record bytes, and bundleId is exactly
// computeEpochRoot(memberHashes) — the same root closeEpoch() stored.
// Tampering with any member changes the recomputed root, so the bundle no
// longer matches (verified by verifyProofBundle(), which recomputes every
// artifact hash and the root from live store bytes — no store trust).
//
// Entry-list bundles (unanchored entries, no epoch yet) use the same root
// construction over the listed hashes so they upgrade cleanly to epoch
// bundles at close time. composedAtUtc and the command/env pins ride
// ALONGSIDE the sealed bytes (never hashed into the root).
//
// No live Cortex calls. No new dependencies.
// ---------------------------------------------------------------------------

import "@/lib/keon/db";
import { db } from "@/lib/keon/db";
import { computeEpochRoot, getEpoch } from "@/lib/keon/epoch";
import {
  canonicalEntryBytes,
  computeEntryHash,
  getLedgerEntryByHash,
  toCanonicalJson,
} from "@/lib/keon/ledger";
import { createHash } from "node:crypto";

// -- Errors ------------------------------------------------------------------

export type ProofBundleErrorCode =
  | "PROOF_BUNDLE_INVALID_INPUT"
  | "PROOF_BUNDLE_UNKNOWN_EPOCH"
  | "PROOF_BUNDLE_UNKNOWN_ENTRY"
  | "PROOF_BUNDLE_MISMATCH";

/** Fail-closed proof-bundle refusal. */
export class ProofBundleError extends Error {
  readonly code: ProofBundleErrorCode;

  constructor(code: ProofBundleErrorCode, message: string) {
    super(message);
    this.name = "ProofBundleError";
    this.code = code;
  }
}

function failClosed(code: ProofBundleErrorCode, message: string): never {
  throw new ProofBundleError(code, message);
}

// -- Manifest ------------------------------------------------------------------

/** Manifest version pin (bumped only by a deliberate contract change). */
export const PROOF_BUNDLE_VERSION = "cortex-mirror-proof-bundle.v1";

/**
 * Verification command pins: the exact local commands that re-verify the
 * sealed artifacts. Static documentation pins (alongside, never hashed).
 */
export const PROOF_BUNDLE_COMMAND_PINS = [
  "npm run typecheck",
  "npm run lint",
  "npx vitest run tests/keon/",
] as const;

export type ProofBundleArtifact = {
  kind: "ledger-entry" | "epoch-record";
  /** Entry hash (ledger-entry) or epoch id (epoch-record). */
  ref: string;
  /** sha256:<hex> of the artifact's canonical bytes. */
  sha256: string;
};

export type ProofBundleManifest = {
  /** Cortex convention: bundleId EQUALS the sealed rootHash. */
  bundleId: string;
  version: typeof PROOF_BUNDLE_VERSION;
  /** Epoch sealed by this bundle, or null for an unanchored entry list. */
  epochId: string | null;
  tenantId: string;
  artifacts: ProofBundleArtifact[];
  commands: readonly string[];
  env: Record<string, string>;
  /** Local composition time — alongside, never hashed into the root. */
  composedAtUtc: string;
};

type MemberRow = {
  entry_hash: string;
  prev_hash: string;
  receipt_ref: string;
  receipt_class: string;
  actor_id: string;
  correlation_id: string;
  tenant_id: string;
  seq: number;
  decided_at_utc: string;
};

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function envPins(): Record<string, string> {
  return {
    mirror: "local-first",
    cortexLive: "false",
    rootConstruction: "sha256(canonical-json(ordered-entry-hashes))",
  };
}

function canonicalEpochRecordBytes(input: {
  epochId: string;
  tenantId: string;
  rootHash: string;
  startSeq: number;
  endSeq: number;
  entryCount: number;
  closedAtUtc: string;
}): string {
  return toCanonicalJson({
    closedAtUtc: input.closedAtUtc,
    endSeq: input.endSeq,
    entryCount: input.entryCount,
    epochId: input.epochId,
    rootHash: input.rootHash,
    startSeq: input.startSeq,
    tenantId: input.tenantId,
  });
}

function entryArtifactForRow(row: MemberRow): { artifact: ProofBundleArtifact; canonicalBytes: string } {
  const canonicalBytes = canonicalEntryBytes({
    seq: row.seq,
    prevHash: row.prev_hash,
    receiptRef: row.receipt_ref,
    correlationId: row.correlation_id,
    tenantId: row.tenant_id,
    receiptClass: row.receipt_class,
    actorId: row.actor_id,
    timestamp: row.decided_at_utc,
  });
  return {
    artifact: { kind: "ledger-entry", ref: row.entry_hash, sha256: `sha256:${sha256Hex(canonicalBytes)}` },
    canonicalBytes,
  };
}

// -- Compose ---------------------------------------------------------------------

export type ComposeProofBundleInput =
  | { epochId: string }
  | { tenantId: string; entryHashes: string[] };

function isEpochInput(input: ComposeProofBundleInput): input is { epochId: string } {
  return (input as { epochId?: unknown }).epochId !== undefined;
}

/**
 * Compose a proof-bundle manifest. Epoch form ({ epochId }) seals the
 * epoch's members: bundleId == the epoch rootHash. Entry-list form
 * ({ tenantId, entryHashes }) seals explicitly listed unanchored entries
 * with the same root construction (bundleId == root over the listed hashes
 * in the given order). Every artifact carries its per-artifact sha256 over
 * canonical bytes. Throws fail-closed on unknown epochs/entries or empty
 * lists — an empty bundle would prove nothing.
 */
export function composeProofBundle(input: ComposeProofBundleInput): ProofBundleManifest {
  const composedAtUtc = new Date().toISOString();
  if (isEpochInput(input)) {
    if (!isNonEmpty(input.epochId)) {
      failClosed("PROOF_BUNDLE_INVALID_INPUT", "Proof-bundle composition requires a non-empty epochId. Failing closed.");
    }
    const epoch = getEpoch(input.epochId);
    if (!epoch) {
      failClosed("PROOF_BUNDLE_UNKNOWN_EPOCH", `Unknown epoch ${JSON.stringify(input.epochId)}. Failing closed.`);
    }
    const rows = db
      .prepare(`SELECT entry_hash, prev_hash, receipt_ref, receipt_class, actor_id, correlation_id, tenant_id, seq, decided_at_utc FROM ledger_entries WHERE tenant_id = ? AND epoch_ref = ? ORDER BY seq ASC`)
      .all(epoch.tenantId, epoch.epochId) as MemberRow[];
    if (rows.length === 0) {
      failClosed("PROOF_BUNDLE_INVALID_INPUT", `Epoch ${epoch.epochId} seals no member rows; refusing an empty bundle. Failing closed.`);
    }
    const artifacts: ProofBundleArtifact[] = rows.map((row) => entryArtifactForRow(row).artifact);
    const recordBytes = canonicalEpochRecordBytes({
      epochId: epoch.epochId,
      tenantId: epoch.tenantId,
      rootHash: epoch.rootHash,
      startSeq: epoch.entryRange.startSeq,
      endSeq: epoch.entryRange.endSeq,
      entryCount: epoch.entryRange.count,
      closedAtUtc: epoch.closedAtUtc,
    });
    artifacts.push({ kind: "epoch-record", ref: epoch.epochId, sha256: `sha256:${sha256Hex(recordBytes)}` });
    return {
      bundleId: epoch.rootHash,
      version: PROOF_BUNDLE_VERSION,
      epochId: epoch.epochId,
      tenantId: epoch.tenantId,
      artifacts,
      commands: PROOF_BUNDLE_COMMAND_PINS,
      env: envPins(),
      composedAtUtc,
    };
  }

  if (!isNonEmpty(input.tenantId)) {
    failClosed("PROOF_BUNDLE_INVALID_INPUT", "Proof-bundle composition requires a non-empty tenantId. Failing closed.");
  }
  if (!Array.isArray(input.entryHashes) || input.entryHashes.length === 0) {
    failClosed("PROOF_BUNDLE_INVALID_INPUT", "Proof-bundle composition requires a non-empty entryHashes list. Failing closed.");
  }
  const artifacts: ProofBundleArtifact[] = [];
  for (const entryHash of input.entryHashes) {
    const entry = getLedgerEntryByHash(entryHash);
    if (!entry) {
      failClosed("PROOF_BUNDLE_UNKNOWN_ENTRY", `Unknown ledger entry ${JSON.stringify(entryHash)}. Failing closed.`);
    }
    if (entry.tenantId !== input.tenantId) {
      failClosed(
        "PROOF_BUNDLE_UNKNOWN_ENTRY",
        `Entry ${entryHash} belongs to tenant ${JSON.stringify(entry.tenantId)}, not ${JSON.stringify(input.tenantId)}. Refusing cross-tenant bundles. Failing closed.`,
      );
    }
    artifacts.push({
      kind: "ledger-entry",
      ref: entry.entryHash,
      sha256: entry.entryHash,
    });
  }
  return {
    bundleId: computeEpochRoot(input.entryHashes),
    version: PROOF_BUNDLE_VERSION,
    epochId: null,
    tenantId: input.tenantId,
    artifacts,
    commands: PROOF_BUNDLE_COMMAND_PINS,
    env: envPins(),
    composedAtUtc,
  };
}

// -- Verify (recompute path — no store trust) ----------------------------------------

export type VerifyProofBundleResult = {
  ok: boolean;
  bundleId: string;
  recomputedRoot: string;
  artifactCount: number;
};

/**
 * Verify a manifest by recomputing every ledger-entry artifact hash from the
 * live governed fields plus the root, and comparing to bundleId. Epoch-record
 * artifacts are structural (they describe the seal; the root they carry is
 * re-derived from members, not believed). Returns ok=false with the
 * recomputed root on ANY mismatch (tamper changes the root); throws only on
 * malformed manifests or missing rows.
 */
export function verifyProofBundle(manifest: ProofBundleManifest): VerifyProofBundleResult {
  if (!manifest || typeof manifest !== "object" || !isNonEmpty(manifest.bundleId) || !Array.isArray(manifest.artifacts)) {
    failClosed("PROOF_BUNDLE_INVALID_INPUT", "Proof-bundle manifest is malformed. Failing closed.");
  }
  const entryArtifacts = manifest.artifacts.filter((artifact) => artifact.kind === "ledger-entry");
  if (entryArtifacts.length === 0) {
    failClosed("PROOF_BUNDLE_INVALID_INPUT", "Proof-bundle manifest seals no ledger entries. Failing closed.");
  }
  const liveHashes: string[] = [];
  for (const artifact of entryArtifacts) {
    const entry = getLedgerEntryByHash(artifact.ref);
    if (!entry) {
      failClosed("PROOF_BUNDLE_UNKNOWN_ENTRY", `Bundle entry ${JSON.stringify(artifact.ref)} is missing from the store. Failing closed.`);
    }
    const recomputed = computeEntryHash({
      seq: entry.seq,
      prevHash: entry.prevHash,
      receiptRef: entry.receiptRef,
      correlationId: entry.correlationId,
      tenantId: entry.tenantId,
      receiptClass: entry.receiptClass,
      actorId: entry.actorId,
      timestamp: entry.timestamp,
    });
    if (recomputed !== entry.entryHash || recomputed !== artifact.sha256) {
      // Tamper (or a forged manifest): the recomputed bytes no longer match
      // the sealed artifact — report mismatch with the diverged root.
      const poisoned = liveHashes.concat(`tamper-at-${artifact.ref}`);
      return { ok: false, bundleId: manifest.bundleId, recomputedRoot: computeEpochRoot(poisoned), artifactCount: entryArtifacts.length };
    }
    if (manifest.tenantId !== entry.tenantId) {
      return { ok: false, bundleId: manifest.bundleId, recomputedRoot: computeEpochRoot(liveHashes.concat(`tenant-mismatch-${artifact.ref}`)), artifactCount: entryArtifacts.length };
    }
    liveHashes.push(entry.entryHash);
  }
  const recomputedRoot = computeEpochRoot(liveHashes);
  if (recomputedRoot !== manifest.bundleId) {
    return { ok: false, bundleId: manifest.bundleId, recomputedRoot, artifactCount: entryArtifacts.length };
  }
  return { ok: true, bundleId: manifest.bundleId, recomputedRoot, artifactCount: entryArtifacts.length };
}

/**
 * Strict variant: throws PROOF_BUNDLE_MISMATCH unless the manifest verifies
 * by recompute. Use on paths where an unverified bundle must refuse.
 */
export function requireValidProofBundle(manifest: ProofBundleManifest): VerifyProofBundleResult {
  const result = verifyProofBundle(manifest);
  if (!result.ok) {
    failClosed(
      "PROOF_BUNDLE_MISMATCH",
      `Proof bundle ${manifest.bundleId} does not verify (recomputedRoot=${result.recomputedRoot}). Failing closed.`,
    );
  }
  return result;
}
