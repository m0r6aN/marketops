// ---------------------------------------------------------------------------
// Keon integration contract mirrors (k0-contracts-keon, contract-first).
// JSON Schemas in contracts/Keon*.json + contracts/DeliberationCandidate.json
// + contracts/ScanReceipt.json + contracts/LedgerEntry.json are the source of
// truth; fixtures live in tests/contracts/fixtures/keon/*.json. Additive only:
// no clients, no transport, no network calls. Do not reshape entities.ts here.
// ---------------------------------------------------------------------------

/** Genesis prevHash: the seq-0 LedgerEntry's prevHash MUST equal this constant. */
export const LEDGER_GENESIS_PREV_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000";

/** Mirrors BioStack PolicyHash(Value, Version). */
export type KeonPolicyHash = {
  value: string;
  version: string;
};

export type KeonFailureStage =
  | "precheck"
  | "decision"
  | "hash"
  | "audit"
  | "evidence-pack"
  | "verify"
  | "exception";

/** Gateway envelope outcome class (S8). */
export type KeonEnvelopeStatus = "ok" | "denied" | "error";

/** Runtime disposition outcome. Coarse mirror of BioStack PolicyDecision. */
export type KeonDispositionDecision = "authorize" | "deny" | "require-review";

export type KeonEnvelope = {
  /**
   * Gateway wire id for this call. Threads into MarketOps receipts as
   * correlationId (PublishPacket.correlationId); every downstream receipt
   * cites it.
   */
  correlation_id: string;
  /** Keon gateway tool that produced this envelope, e.g. keon.runtime.decide.v1. */
  tool: string;
  ok: boolean;
  status: KeonEnvelopeStatus;
  decision: {
    status: KeonDispositionDecision;
    policy_hash: KeonPolicyHash;
  };
  /** Tool-specific result payload on authorize/require-review. Absent otherwise. */
  result?: Record<string, unknown>;
  denialCode?: string;
  denialMessage?: string;
  failureStage?: KeonFailureStage;
  /** Receipt URIs evidencing this call (keon:// when anchored). */
  receipts: string[];
  /** MCP transport failure flag; distinct from policy denial. */
  isError: boolean;
};

/** Effect class. Mirrors the ReceiptEffectStatus allowlist doctrine. */
export type KeonEffectKind =
  | "effect-bearing"
  | "non-effecting"
  | "commentary-only";

export type KeonDecisionRequest = {
  /** What is governed, in kind:{id} form per ReceiptRefs. */
  subjectUri: string;
  /**
   * Canonical tenant key. The governance boundary the actor operates within;
   * cross-tenant access with a mismatched tenantId must be denied with a
   * receipt.
   */
  tenantId: string;
  /** Who initiated the effect: user:{guid} or system:{component}. */
  actorId: string;
  /** Governed capability requested, e.g. marketops.campaign.publish. */
  capability: string;
  effect: KeonEffectKind;
  /** Free-form governed context. Never carries secrets or keys. */
  context: Record<string, unknown>;
  /**
   * Dedupe key for this request. Replays with the same key never
   * double-apply an effect.
   */
  idempotencyKey: string;
};

export type KeonDisposition = {
  decision: KeonDispositionDecision;
  policyHash: KeonPolicyHash;
  /** keon://receipt/{id} anchored, or a distinct local unanchored scheme. */
  decisionReceiptUri?: string;
  /** Taxonomy class in family.subject.action form (ReceiptClass discipline). */
  receiptClass?: string;
  denialCode?: string;
  denialMessage?: string;
  failureStage?: KeonFailureStage;
};

export type KeonDecisionPair = {
  request: KeonDecisionRequest;
  /** Present once Keon has decided; absent while undecided. */
  disposition?: KeonDisposition;
};

export type DeliberationChallenge = {
  challenge: string;
  raisedBy?: string;
  severity?: "low" | "medium" | "high";
};

export type DeliberationCandidate = {
  candidate: {
    branch: string;
    collapseRef: string;
    /** Rationale text. Evidence only; never an instruction to act. */
    rationale: string;
  };
  challenges: DeliberationChallenge[];
  /**
   * Dissenting view, preserved verbatim. Literal 'none-voiced' when no
   * dissent was voiced; never dropped, never an empty string. Advisory
   * evidence only: this candidate carries NO execution permission.
   */
  dissent: string;
  confidence: {
    value: number;
    calibrationVersion: string;
  };
  heatRef?: string;
  lineage: {
    intentId: string;
    collapseId: string;
    reviewId: string;
  };
  /**
   * Canonical tenant key. Deliberation evidence is tenant-scoped;
   * cross-tenant evidence must never leak into another tenant's review.
   */
  tenantId: string;
};

/** Byte provenance for a BrowseAhead scan. */
export type ScanProvenance = "caller_supplied" | "fetched";

export type ScanReceipt = {
  scan: {
    /** MVP raw-only. */
    mode: "raw";
    /**
     * Byte provenance. caller_supplied: scanned bytes came from the caller
     * (customer-finder/citation path input). fetched: the gateway fetched the
     * URL itself (sourceUri required). fetched-provenance on caller bytes is
     * rejected: callers must declare caller_supplied.
     */
    provenance: ScanProvenance;
    policyVersion: string;
    sourceUri?: string;
  };
  severity: "none" | "low" | "medium" | "high" | "critical";
  ingestionHint: "allow" | "quarantine" | "fail_closed";
  /** sha256:<hex> of the sanitized bundle. Only sanitized bytes ingest. */
  sanitizedBundleHash: string;
  /** sha256:<hex> of the pre-sanitization bytes. Never ingested. */
  rawContentHash: string;
  /** MarketOps canonical hash (bare hex) of the canonical scan record. */
  canonicalSha256: string;
  /** Null in MVP (deferred signing): null means unsigned, not invalid. */
  signature: {
    algorithm: string;
    value: string;
    signedAtUtc?: string;
  } | null;
  /**
   * Canonical tenant key. Scan receipts are tenant-scoped; cross-tenant
   * scan state must never leak.
   */
  tenantId: string;
  actorId: string;
  /**
   * MarketOps correlation id threading this scan into downstream receipts
   * (PublishPacket.correlationId; gateway correlation_id on the wire).
   */
  correlationId: string;
  scannedAtUtc: string;
};

export type LedgerEntry = {
  /** Monotonic sequence number within this tenant's chain (genesis is 0). */
  seq: number;
  /** Previous entry's entryHash; the genesis constant at seq 0. */
  prevHash: string;
  /** Required receipt URI: keon:// or a distinct local unanchored scheme. */
  receiptRef: string;
  /**
   * MarketOps correlation id threading this entry back to the gateway call
   * and originating effect (PublishPacket.correlationId).
   */
  correlationId: string;
  /** Chain hash over the governed fields plus prevHash (S11 verifier). */
  entryHash: string;
  /**
   * Cortex epoch anchor reference. Null until S11 epoch anchoring lands;
   * verifiers must accept null, not treat it as a broken chain.
   */
  epochRef: string | null;
  /**
   * Canonical tenant key. A ledger chain seals evidence for exactly one
   * tenant; multi-tenant chains are forbidden.
   */
  tenantId: string;
};
