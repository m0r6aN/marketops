/**
 * k2-cortex-mirror — S11 local-first receipt mirror (hash chain + epoch
 * anchoring + proof-bundle composition). No live Cortex calls.
 *
 * Doctrine under test: chain-over-collection; append-only; entries derive
 * from receipts, never authorize; deterministic canonical JSON (sorted keys,
 * SHA-256, no wall-clock inside hashed fields); local chain verifies
 * standalone; epoch anchoring composes additively, never rewrites history.
 *
 * - append -> verify pass (incl. the canonical pin vector fixture).
 * - Tampered entries are detected (stored bytes no longer recompute).
 * - Reordered / gapped chains fail (never skipped).
 * - Entries without a receiptRef (or with a bare id) are rejected.
 * - Epoch close seals the unanchored suffix; inclusion recomputes from live
 *   rows (no store trust); history is never rehashed across closes.
 * - Proof bundles carry bundleId == root; tamper changes the root.
 * - Unanchored-marker receipts mirror as distinguishable (never keon://).
 * - The mirror hook never throws into the safety path (explicit Unappended).
 */
import { beforeEach, describe, expect, test } from "vitest";

import { db, purgeLedgerMirrorData } from "@/lib/keon/db";
import {
  appendLedgerEntry,
  canonicalEntryBytes,
  computeEntryHash,
  findLedgerEntriesByCorrelationId,
  findLedgerEntriesByReceiptRef,
  LedgerError,
  LEDGER_MIRROR_ACTOR_ID,
  LEDGER_MIRROR_RECEIPT_CLASS,
  LEDGER_UNANCHORED_RECEIPT_SCHEME,
  listLedgerEntries,
  tryMirrorClaimDecisionReceipt,
  verifyChain,
} from "@/lib/keon/ledger";
import { LEDGER_GENESIS_PREV_HASH } from "@/lib/keon/types";
import {
  closeEpoch,
  EpochError,
  getEpoch,
  listEpochs,
  requireEntryInEpoch,
  verifyEntryInEpoch,
} from "@/lib/keon/epoch";
import {
  composeProofBundle,
  PROOF_BUNDLE_VERSION,
  requireValidProofBundle,
  verifyProofBundle,
} from "@/lib/keon/proof-bundle";
import vector from "../contracts/fixtures/keon/cortex-mirror-vectors.json";

const TENANT = "tenant-cortex-mirror";
const OTHER_TENANT = "tenant-cortex-other";

function appendInput(overrides: Record<string, unknown> = {}) {
  return {
    receiptRef: "keon://receipt/dec-9f02ab41c7",
    correlationId: "t:tenant-cortex-mirror|c:publish-001",
    tenantId: TENANT,
    receiptClass: "ledger.entry.appended",
    actorId: "user:3fa85f64-5717-4562-b3fc-2c963f66afa6",
    decidedAtUtc: "2026-09-12T14:30:00Z",
    ...overrides,
  };
}

function expectLedgerCode(fn: () => unknown, code: LedgerError["code"]): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(LedgerError);
    expect((error as LedgerError).code).toBe(code);
    return;
  }
  expect.unreachable(`expected LedgerError ${code}`);
}

beforeEach(() => {
  purgeLedgerMirrorData(TENANT);
  purgeLedgerMirrorData(OTHER_TENANT);
  purgeLedgerMirrorData("tenant-keon");
});

describe("k2 cortex mirror append + verify", () => {
  test("canonical pin vector reproduces byte-for-byte (no drift)", () => {
    const governed = vector.governed as unknown as Parameters<typeof canonicalEntryBytes>[0];
    expect(canonicalEntryBytes(governed)).toBe(vector.canonicalBytes);
    expect(computeEntryHash(governed)).toBe(vector.entryHash);
  });

  test("append -> verify pass across anchored + unanchored rows", () => {
    const first = appendLedgerEntry(appendInput());
    expect(first.seq).toBe(0);
    expect(first.prevHash).toBe(LEDGER_GENESIS_PREV_HASH);
    expect(first.epochRef).toBeNull();

    const second = appendLedgerEntry(
      appendInput({
        receiptRef: "marketops://unanchored-receipt/7f3a9c1e5b2d4a8f9e0c1d3b5a69788",
        correlationId: "t:tenant-cortex-mirror|c:safety-note-002",
        actorId: "system:safety-monitor",
        decidedAtUtc: "2026-09-12T14:31:00Z",
      }),
    );
    expect(second.seq).toBe(1);
    expect(second.prevHash).toBe(first.entryHash);

    const result = verifyChain(TENANT);
    expect(result.count).toBe(2);
    expect(result.headHash).toBe(second.entryHash);

    // Read-only queries thread back to the originating receipts.
    expect(findLedgerEntriesByReceiptRef(first.receiptRef).map((entry) => entry.entryHash)).toEqual([
      first.entryHash,
    ]);
    expect(
      findLedgerEntriesByCorrelationId("t:tenant-cortex-mirror|c:safety-note-002").map(
        (entry) => entry.entryHash,
      ),
    ).toEqual([second.entryHash]);
    expect(listLedgerEntries(TENANT).map((entry) => entry.seq)).toEqual([0, 1]);
  });

  test("tampered entry detected (stored bytes no longer recompute)", () => {
    appendLedgerEntry(appendInput());
    const second = appendLedgerEntry(
      appendInput({
        receiptRef: "keon://receipt/req-rev-4b08c1d2e5",
        correlationId: "t:tenant-cortex-mirror|c:publish-002",
        decidedAtUtc: "2026-09-12T14:31:00Z",
      }),
    );
    expect(verifyChain(TENANT).count).toBe(2);

    db.prepare(`UPDATE ledger_entries SET receipt_ref = ? WHERE entry_hash = ?`).run(
      "keon://receipt/tampered",
      second.entryHash,
    );
    expectLedgerCode(() => verifyChain(TENANT), "LEDGER_TAMPER_DETECTED");
  });

  test("gapped chain fails (never skipped)", () => {
    appendLedgerEntry(appendInput());
    appendLedgerEntry(
      appendInput({
        receiptRef: "keon://receipt/req-rev-4b08c1d2e5",
        correlationId: "t:tenant-cortex-mirror|c:publish-002",
        decidedAtUtc: "2026-09-12T14:31:00Z",
      }),
    );
    appendLedgerEntry(
      appendInput({
        receiptRef: "marketops://unanchored-receipt/7f3a9c1e5b2d4a8f9e0c1d3b5a69788",
        correlationId: "t:tenant-cortex-mirror|c:safety-note-003",
        decidedAtUtc: "2026-09-12T14:32:00Z",
      }),
    );
    expect(verifyChain(TENANT).count).toBe(3);

    db.prepare(`DELETE FROM ledger_entries WHERE tenant_id = ? AND seq = 1`).run(TENANT);
    expectLedgerCode(() => verifyChain(TENANT), "LEDGER_CHAIN_GAP");
  });

  test("reordered chain fails (prevHash continuity break)", () => {
    const first = appendLedgerEntry(appendInput());
    const second = appendLedgerEntry(
      appendInput({
        receiptRef: "keon://receipt/req-rev-4b08c1d2e5",
        correlationId: "t:tenant-cortex-mirror|c:publish-002",
        decidedAtUtc: "2026-09-12T14:31:00Z",
      }),
    );
    expect(verifyChain(TENANT).count).toBe(2);

    // Swap the two rows' positions via a temp seq (UNIQUE(tenant_id, seq)).
    db.prepare(`UPDATE ledger_entries SET seq = ? WHERE entry_hash = ?`).run(99, first.entryHash);
    db.prepare(`UPDATE ledger_entries SET seq = ? WHERE entry_hash = ?`).run(0, second.entryHash);
    db.prepare(`UPDATE ledger_entries SET seq = ? WHERE entry_hash = ?`).run(1, first.entryHash);
    expectLedgerCode(() => verifyChain(TENANT), "LEDGER_CHAIN_GAP");
  });

  test("entry without receiptRef (or with a bare id) is rejected", () => {
    expectLedgerCode(() => appendLedgerEntry(appendInput({ receiptRef: "" })), "LEDGER_INVALID_RECEIPT_REF");
    expectLedgerCode(
      () => appendLedgerEntry(appendInput({ receiptRef: "dec-9f02ab41c7" })),
      "LEDGER_INVALID_RECEIPT_REF",
    );
    expectLedgerCode(
      () => appendLedgerEntry(appendInput({ receiptRef: "  " })),
      "LEDGER_INVALID_RECEIPT_REF",
    );
    // Nothing was appended by the refusals.
    expect(verifyChain(TENANT).count).toBe(0);
  });

  test("cross-tenant appends never share a chain", () => {
    const mine = appendLedgerEntry(appendInput());
    const theirs = appendLedgerEntry(
      appendInput({
        tenantId: OTHER_TENANT,
        correlationId: "t:tenant-cortex-other|c:publish-001",
      }),
    );
    // Each tenant chain starts at its own genesis.
    expect(mine.seq).toBe(0);
    expect(theirs.seq).toBe(0);
    expect(theirs.prevHash).toBe(LEDGER_GENESIS_PREV_HASH);
    expect(verifyChain(TENANT).count).toBe(1);
    expect(verifyChain(OTHER_TENANT).count).toBe(1);
  });
});

describe("k2 cortex mirror epochs", () => {
  test("close seals the suffix; inclusion recomputes (no store trust)", () => {
    const first = appendLedgerEntry(appendInput());
    const second = appendLedgerEntry(
      appendInput({
        receiptRef: "keon://receipt/req-rev-4b08c1d2e5",
        correlationId: "t:tenant-cortex-mirror|c:publish-002",
        decidedAtUtc: "2026-09-12T14:31:00Z",
      }),
    );
    const epoch = closeEpoch({ tenantId: TENANT, closedAtUtc: "2026-09-12T15:00:00Z" });
    expect(epoch.entryRange).toEqual({ startSeq: 0, endSeq: 1, count: 2 });
    expect(epoch.rootHash).toMatch(/^sha256:[a-f0-9]{64}$/);

    // Anchoring composes additively: hashes untouched, chain still verifies.
    expect(verifyChain(TENANT).count).toBe(2);
    expect(getEpoch(epoch.epochId)?.rootHash).toBe(epoch.rootHash);

    const inclusion = verifyEntryInEpoch(first.entryHash, epoch.epochId);
    expect(inclusion.included).toBe(true);
    expect(inclusion.recomputedRoot).toBe(epoch.rootHash);
    expect(inclusion.storedRoot).toBe(epoch.rootHash);
    expect(requireEntryInEpoch(second.entryHash, epoch.epochId).included).toBe(true);

    // A stranger entry is not included (proven absence, not an error).
    expect(verifyEntryInEpoch(`sha256:${"ab".repeat(32)}`, epoch.epochId).included).toBe(false);
  });

  test("history is never rehashed: second close partitions, first root unchanged", () => {
    appendLedgerEntry(appendInput());
    const firstEpoch = closeEpoch({ tenantId: TENANT });
    const firstRoot = firstEpoch.rootHash;

    const third = appendLedgerEntry(
      appendInput({
        receiptRef: "marketops://unanchored-receipt/7f3a9c1e5b2d4a8f9e0c1d3b5a69788",
        correlationId: "t:tenant-cortex-mirror|c:safety-note-003",
        decidedAtUtc: "2026-09-12T14:32:00Z",
      }),
    );
    const secondEpoch = closeEpoch({ tenantId: TENANT });
    expect(secondEpoch.entryRange).toEqual({ startSeq: 1, endSeq: 1, count: 1 });
    expect(getEpoch(firstEpoch.epochId)?.rootHash).toBe(firstRoot);
    expect(verifyEntryInEpoch(third.entryHash, secondEpoch.epochId).included).toBe(true);
    expect(verifyEntryInEpoch(third.entryHash, firstEpoch.epochId).included).toBe(false);
    expect(listEpochs(TENANT).map((epoch) => epoch.epochId)).toEqual([
      firstEpoch.epochId,
      secondEpoch.epochId,
    ]);
  });

  test("tamper breaks inclusion even when the epoch row looks intact", () => {
    const first = appendLedgerEntry(appendInput());
    appendLedgerEntry(
      appendInput({
        receiptRef: "keon://receipt/req-rev-4b08c1d2e5",
        correlationId: "t:tenant-cortex-mirror|c:publish-002",
        decidedAtUtc: "2026-09-12T14:31:00Z",
      }),
    );
    const epoch = closeEpoch({ tenantId: TENANT });
    expect(verifyEntryInEpoch(first.entryHash, epoch.epochId).included).toBe(true);

    db.prepare(`UPDATE ledger_entries SET actor_id = ? WHERE entry_hash = ?`).run(
      "user:tampered",
      first.entryHash,
    );
    const after = verifyEntryInEpoch(first.entryHash, epoch.epochId);
    expect(after.included).toBe(false);
    expect(after.recomputedRoot).not.toBe(after.storedRoot);
  });

  test("closing an empty suffix and unknown epochs fail closed", () => {
    try {
      closeEpoch({ tenantId: TENANT });
      expect.unreachable("expected EPOCH_NOTHING_TO_ANCHOR");
    } catch (error) {
      expect(error).toBeInstanceOf(EpochError);
      expect((error as EpochError).code).toBe("EPOCH_NOTHING_TO_ANCHOR");
    }
    try {
      verifyEntryInEpoch(`sha256:${"ab".repeat(32)}`, "epoch:tenant-cortex-mirror:0-0");
      expect.unreachable("expected EPOCH_UNKNOWN");
    } catch (error) {
      expect(error).toBeInstanceOf(EpochError);
      expect((error as EpochError).code).toBe("EPOCH_UNKNOWN");
    }
  });
});

describe("k2 cortex mirror proof bundles", () => {
  test("bundle id == epoch root; tamper changes the root", () => {
    const first = appendLedgerEntry(appendInput());
    appendLedgerEntry(
      appendInput({
        receiptRef: "keon://receipt/req-rev-4b08c1d2e5",
        correlationId: "t:tenant-cortex-mirror|c:publish-002",
        decidedAtUtc: "2026-09-12T14:31:00Z",
      }),
    );
    const epoch = closeEpoch({ tenantId: TENANT });
    const bundle = composeProofBundle({ epochId: epoch.epochId });

    // Cortex convention: bundleId EQUALS the sealed root.
    expect(bundle.bundleId).toBe(epoch.rootHash);
    expect(bundle.version).toBe(PROOF_BUNDLE_VERSION);
    expect(bundle.epochId).toBe(epoch.epochId);
    expect(bundle.artifacts.length).toBe(3); // 2 entries + 1 epoch record
    for (const artifact of bundle.artifacts) {
      expect(artifact.sha256).toMatch(/^sha256:[a-f0-9]{64}$/);
    }
    expect(bundle.commands.length).toBeGreaterThan(0);
    expect(verifyProofBundle(bundle).ok).toBe(true);
    expect(requireValidProofBundle(bundle).recomputedRoot).toBe(epoch.rootHash);

    // Tamper with a member: the recomputed root diverges, bundle refuses.
    db.prepare(`UPDATE ledger_entries SET receipt_ref = ? WHERE entry_hash = ?`).run(
      "keon://receipt/tampered",
      first.entryHash,
    );
    const after = verifyProofBundle(bundle);
    expect(after.ok).toBe(false);
    expect(after.recomputedRoot).not.toBe(bundle.bundleId);
  });

  test("entry-list bundles seal unanchored entries with the same construction", () => {
    const first = appendLedgerEntry(appendInput());
    const bundle = composeProofBundle({ tenantId: TENANT, entryHashes: [first.entryHash] });
    expect(bundle.epochId).toBeNull();
    expect(bundle.bundleId).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(bundle.artifacts.map((artifact) => artifact.ref)).toEqual([first.entryHash]);
    expect(verifyProofBundle(bundle).ok).toBe(true);
  });
});

describe("k2 cortex mirror receipt grounding", () => {
  test("unanchored-marker receipts mirror as distinguishable (never keon://)", () => {
    const outcome = tryMirrorClaimDecisionReceipt({
      receiptId: "receipt-unanchored-1",
      reviewId: "review-1",
      contentVersionId: "content-version-1",
      createdAt: "2026-09-12T14:30:00Z",
      tenantId: TENANT,
    });
    expect(outcome.status).toBe("appended");
    if (outcome.status !== "appended") return;
    expect(outcome.entry.receiptRef).toBe(
      `${LEDGER_UNANCHORED_RECEIPT_SCHEME}receipt-unanchored-1`,
    );
    expect(outcome.entry.receiptRef.startsWith("keon://")).toBe(false);
    expect(outcome.entry.receiptClass).toBe(LEDGER_MIRROR_RECEIPT_CLASS);
    expect(outcome.entry.actorId).toBe(LEDGER_MIRROR_ACTOR_ID);
    expect(verifyChain(TENANT).count).toBe(1);
  });

  test("mirror hook never throws: bad input yields explicit Unappended", () => {
    const outcome = tryMirrorClaimDecisionReceipt({
      receiptId: "receipt-bad-time",
      reviewId: "review-1",
      contentVersionId: "content-version-1",
      createdAt: "not-a-timestamp",
      tenantId: TENANT,
    });
    expect(outcome.status).toBe("unappended");
    if (outcome.status !== "unappended") return;
    expect(outcome.reason.length).toBeGreaterThan(0);
    // The refusal appended nothing.
    expect(verifyChain(TENANT).count).toBe(0);
  });
});
