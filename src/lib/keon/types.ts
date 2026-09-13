// ---------------------------------------------------------------------------
// Keon integration contract mirrors (k0-contracts-keon, contract-first).
// JSON Schemas in contracts/Keon*.json + contracts/DeliberationCandidate.json
// + contracts/ScanReceipt.json + contracts/LedgerEntry.json are the source of
// truth; fixtures live in tests/contracts/fixtures/keon/*.json. Additive only:
// no clients, no transport, no network calls. Do not reshape entities.ts here.
// Contract fields are camelCase throughout (correlationId, policyHash,
// denialCode); the FUTURE S8 adapter maps them to the snake_case gateway wire
// form (correlation_id, policy_hash) — never the contracts.
// ---------------------------------------------------------------------------

/**
 * Genesis prevHash: the seq-0 LedgerEntry's prevHash MUST equal this constant.
 * Mirrors BioStack SpineChain.GenesisPreviousHash ("sha256:genesis").
 */
export const LEDGER_GENESIS_PREV_HASH = "sha256:genesis";

/**
 * Native BioStack PolicyDecision on the HTTP wire, exactly as
 * PolicyGateEndpoints.DecisionString renders it. REQUIRED everywhere a
 * decision outcome is carried; the coarse disposition below is derived from
 * it via KEON_DISPOSITION_DERIVATION, never substituted for it.
 */
export type KeonPolicyDecision =
  | "allowed"
  | "allowed-with-disclaimer"
  | "rewrite-required"
  | "blocked"
  | "escalate-to-provider-review";

/** All five native decisions, in BioStack PolicyDecision enum order. */
export const KEON_POLICY_DECISIONS: readonly KeonPolicyDecision[] = [
  "allowed",
  "allowed-with-disclaimer",
  "rewrite-required",
  "blocked",
  "escalate-to-provider-review",
];

/** Coarse MarketOps disposition. DERIVED from KeonPolicyDecision, never native. */
export type KeonDispositionDecision = "authorize" | "deny" | "require-review";

/**
 * Native-to-coarse derivation mapping (mirrors the joint-review ruling):
 * allowed/allowed-with-disclaimer -> authorize; blocked -> deny;
 * rewrite-required/escalate-to-provider-review -> require-review.
 */
export const KEON_DISPOSITION_DERIVATION: Record<
  KeonPolicyDecision,
  KeonDispositionDecision
> = {
  allowed: "authorize",
  "allowed-with-disclaimer": "authorize",
  "rewrite-required": "require-review",
  blocked: "deny",
  "escalate-to-provider-review": "require-review",
};

/** Derive the coarse disposition from a native BioStack PolicyDecision. */
export function deriveKeonDispositionDecision(
  native: KeonPolicyDecision
): KeonDispositionDecision {
  return KEON_DISPOSITION_DERIVATION[native];
}

/**
 * Distinct zeroed-hash policy markers: three different (value, version)
 * pairs, documented here and never conflated. Marker identity lives in the
 * value; every marker carries version "0.0.0". No marker ever accompanies an
 * anchored keon:// receipt.
 */
export const KEON_MARKER_UNANCHORED = {
  value: "unanchored-local",
  version: "0.0.0",
} as const;
export const KEON_MARKER_LOCAL_CLASSIFIER = {
  value: "local-classifier-v0",
  version: "0.0.0",
} as const;
export const KEON_MARKER_CLIENT_FAIL_CLOSED = {
  value: "ERROR",
  version: "0.0.0",
} as const;
// Sources: RuntimeReceiptFactory.UnanchoredPolicyHash ("unanchored-local") for
// unanchored provenance rows; PolicyGate.ZeroedPolicyHash
// ("local-classifier-v0", in BioStack.Application/Governance/PolicyGate.cs)
// for local pre-classification; KeonRuntimeClient.FailedHash ("ERROR") for
// live-client fail-closed (Blocked + keon-offline BlockReason; issuance
// throws KeonRuntimeUnavailableException). NOTE: the dev-only stub marker
// ("stub-policy-v0", "0.0.0") in KeonRuntimeClientStub must never appear in
// contracts.

/**
 * Explicit reserved receipt-class catalog. MarketOps classes below are
 * reserved-not-wired pending S8-S13 joint naming review: live code issues
 * none of them until wired. Fixtures may illustrate reserved classes but must
 * never issue foreign (non-MarketOps, non-generic) classes. The
 * legacy.unclassified sentinel is accepted for backfilled rows only, never
 * issued by new code. Pattern mirrors ReceiptClass family.subject.action
 * discipline (see KEON_RECEIPT_CLASS_PATTERN).
 */
export const KEON_RECEIPT_CLASS_CATALOG = {
  status: "reserved-not-wired",
  families: [
    "campaign.publish.*",
    "approval.*",
    "billing.*",
    "browseahead.scan.*",
    "ledger.entry.*",
  ],
  sentinel: "legacy.unclassified",
} as const;

/** Schema-side pattern source: family.subject.action, plus the sentinel. */
export const KEON_RECEIPT_CLASS_PATTERN =
  "^(legacy\\.unclassified|[a-z0-9]+(\\.[a-z0-9-]+){2})$";

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

export type KeonEnvelopeDecision = {
  /** Native BioStack PolicyDecision (REQUIRED; status is derived from it). */
  policyDecision: KeonPolicyDecision;
  /** DERIVED coarse disposition (see KEON_DISPOSITION_DERIVATION). */
  status: KeonDispositionDecision;
  policyHash: KeonPolicyHash;
};

export type KeonEnvelope = {
  /**
   * Gateway id for this call. Threads into MarketOps receipts as
   * correlationId (PublishPacket.correlationId); every downstream receipt
   * cites it.
   */
  correlationId: string;
  /** Keon gateway tool that produced this envelope, e.g. keon.policy.check.v1. */
  tool: string;
  ok: boolean;
  status: KeonEnvelopeStatus;
  decision: KeonEnvelopeDecision;
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

/**
 * Governed-effect proposal evaluated through the PolicyCheck path.
 * Mirrors PolicyGateRequest (Text/Context/TenantId/ActorId evaluated via
 * IKeonRuntimeClient.PolicyCheckAsync); subjectUri/capability/effect/
 * idempotencyKey are MarketOps proposal-side extensions threaded into the
 * receipt at issuance. IKeonRuntimeClient exposes NO Decide method.
 */
export type KeonPolicyCheckRequest = {
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
   * Dedupe key for this check. Replays with the same key never
   * double-apply an effect.
   */
  idempotencyKey: string;
};

/**
 * Receipt input recorded via IKeonRuntimeClient.IssueReceiptAsync.
 * Mirrors ReceiptRequest (SubjectUri/TenantId/ActorId/Decision/EffectStatus/
 * ReceiptClass); subject/tenant/actor bind once on the check and are not
 * repeated here. policyDecision carries the native outcome; decision is the
 * derived coarse disposition (see KEON_DISPOSITION_DERIVATION).
 */
export type KeonReceiptRequest = {
  policyDecision: KeonPolicyDecision;
  decision: KeonDispositionDecision;
  policyHash: KeonPolicyHash;
  /** Required when policyDecision is allowed-with-disclaimer. */
  disclaimerText?: string;
  /** Required when policyDecision is rewrite-required. */
  rewrittenText?: string;
  /** keon://receipt/{id} anchored, or a distinct local unanchored scheme. */
  decisionReceiptUri?: string;
  /** Taxonomy class in family.subject.action form (ReceiptClass discipline). */
  receiptClass?: string;
  denialCode?: string;
  denialMessage?: string;
  failureStage?: KeonFailureStage;
};

export type KeonDecisionPair = {
  policyCheck: KeonPolicyCheckRequest;
  /** Present once Keon has answered; absent while undecided. */
  receiptRequest?: KeonReceiptRequest;
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
   * (PublishPacket.correlationId; the FUTURE S8 adapter maps this to gateway
   * correlation_id on the wire, never the contracts).
   */
  correlationId: string;
  scannedAtUtc: string;
};

export type LedgerEntry = {
  /** Monotonic sequence number within this tenant's chain (genesis is 0). */
  seq: number;
  /**
   * Previous entry's entryHash in sha256:<hex> form; the genesis constant
   * (LEDGER_GENESIS_PREV_HASH) at seq 0.
   */
  prevHash: string;
  /** Required receipt URI: keon:// or a distinct local unanchored scheme. */
  receiptRef: string;
  /**
   * MarketOps correlation id threading this entry back to the gateway call
   * and originating effect (PublishPacket.correlationId).
   */
  correlationId: string;
  /**
   * Chain hash in sha256:<hex> form over the governed fields (including
   * actorId, receiptClass, and timestamp) plus prevHash (S11 verifier).
   */
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
  /**
   * Taxonomy class in family.subject.action form (mirrors
   * SpineEntry.ReceiptClass; see KEON_RECEIPT_CLASS_CATALOG for the
   * reserved-not-wired MarketOps families).
   */
  receiptClass: string;
  /**
   * Who initiated the governed effect (mirrors ReceiptActor ActorId and
   * SpineEntry.ActorId).
   */
  actorId: string;
  /**
   * UTC timestamp of the governed effect (mirrors
   * DecisionReceipt.TimestampUtc and SpineEntry.TimestampUtc).
   */
  timestamp: string;
};
