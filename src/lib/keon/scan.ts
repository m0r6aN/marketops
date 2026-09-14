// ---------------------------------------------------------------------------
// k1-browseahead-intake — BrowseAhead scan intake (S13, sanitized-only).
//
// Wires ScanReceipt intake into the customer-finder + citation-readiness
// sourcing paths with sanitized-bundle-only enforcement:
//
// - requestScan() takes caller-supplied bytes plus tenant/actor/correlation
//   context and a caller-injected ScannerPort (stub now, live gateway later).
//   MVP is raw-only: any url / provenance=fetched request fails closed with
//   SCAN_URL_FETCH_NOT_ENABLED. No network calls happen here.
// - Only the sanitized bundle is ever ingestible. RawContent and
//   SanitizedBundle are distinct branded types; every downstream ingest
//   helper accepts SanitizedBundle only, and toIngestibleEvidence() also
//   guards at runtime (kind check) so untyped callers fail closed with
//   SCAN_RAW_NOT_INGESTIBLE instead of persisting raw excerpts.
// - High/critical findings (ingestionHint fail_closed) never produce a
//   bundle: the outcome is blocked with a reason and null bundle, and the
//   receipt refs (hashes) are still returned for quarantine/forensics.
//
// Contract source of truth: contracts/ScanReceipt.json + KeonEnvelope.
// Determinism: requestScan performs no randomness and no I/O beyond the
// injected port; identical inputs through a deterministic port yield
// identical hashes.
// ---------------------------------------------------------------------------

import { createHash } from "node:crypto";

import type { ScanProvenance, ScanReceipt } from "@/lib/keon/types";

// -- Distinct content types: raw must be unrepresentable downstream ----------

// Nominal brands: real symbols (not `declare const`) so the brand keys also
// exist at runtime. Symbol keys never survive JSON serialization, so receipt
// hashes and bundle text stay byte-stable while the types stay nominal.
const rawBrand = Symbol("marketops.keon.rawContent");
const sanitizedBrand = Symbol("marketops.keon.sanitizedBundle");

/**
 * Caller-supplied pre-scan bytes. Quarantine/forensics only: no ingest,
 * persist, or evidence helper accepts this type.
 */
export type RawContent = {
  readonly kind: "raw";
  readonly text: string;
  readonly [rawBrand]: true;
};

/**
 * The ONLY ingestible form: sanitized bytes bound to their scan receipt
 * hashes. Downstream intake accepts this type and nothing else.
 */
export type SanitizedBundle = {
  readonly kind: "sanitized";
  readonly text: string;
  readonly sanitizedBundleHash: string;
  readonly rawContentHash: string;
  readonly canonicalSha256: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly [sanitizedBrand]: true;
};

/** Wrap caller bytes as explicitly-raw content. Never ingest the result. */
export function makeRawContent(text: string): RawContent {
  return { kind: "raw", text, [rawBrand]: true as const };
}

// -- Injected scanner port (stub now, live gateway later) --------------------

export const SCAN_POLICY_VERSION = "browseahead-policy.v1";

export type ScanPortInput = {
  raw: RawContent;
  tenantId: string;
  actorId: string;
  correlationId: string;
  policyVersion: string;
};

export type ScanPortOutput = {
  receipt: ScanReceipt;
  sanitizedText: string;
};

/**
 * Scanner capability. Injected by the caller (stub in this parcel, gateway
 * adapter later); this module performs no fetching and no network calls.
 */
export type ScannerPort = {
  scan(input: ScanPortInput): Promise<ScanPortOutput> | ScanPortOutput;
};

// -- Request / outcome ---------------------------------------------------------

export type ScanRequest = {
  /** Caller-supplied bytes to scan. Required unless failing closed. */
  content?: string;
  /**
   * Target URL. MVP raw-only: ANY url-bearing request fails closed with
   * SCAN_URL_FETCH_NOT_ENABLED (no live gateway, no fetching here).
   */
  url?: string;
  /**
   * Byte provenance. MVP raw-only: anything other than caller_supplied
   * (including "fetched") fails closed with SCAN_URL_FETCH_NOT_ENABLED.
   */
  provenance?: ScanProvenance;
  tenantId: string;
  actorId: string;
  correlationId: string;
  policyVersion?: string;
};

export type ScanBlockCode = "SCAN_BLOCKED_FAIL_CLOSED" | "SCAN_QUARANTINED";

export type ScanIntakeOutcome = {
  readonly receipt: ScanReceipt;
  /** Null whenever blocked: high/critical findings never yield a bundle. */
  readonly bundle: SanitizedBundle | null;
  readonly blocked: boolean;
  readonly blockReason?: string;
  readonly blockCode?: ScanBlockCode;
};

/** Hash-only receipt summary for recording alongside sourced material. */
export type ScanReceiptRefs = {
  readonly sanitizedBundleHash: string;
  readonly rawContentHash: string;
  readonly canonicalSha256: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly severity: ScanReceipt["severity"];
  readonly ingestionHint: ScanReceipt["ingestionHint"];
  readonly scannedAtUtc: string;
};

export const SCAN_SEVERITIES: readonly ScanReceipt["severity"][] = [
  "none",
  "low",
  "medium",
  "high",
  "critical",
];

export const SCAN_INGESTION_HINTS: readonly ScanReceipt["ingestionHint"][] = [
  "allow",
  "quarantine",
  "fail_closed",
];

export class ScanError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ScanError";
    this.code = code;
  }
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function sha256Uri(input: string): string {
  return `sha256:${sha256Hex(input)}`;
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function failClosed(code: string, message: string): never {
  throw new ScanError(code, message);
}

function validateReceipt(
  receipt: ScanReceipt,
  request: { tenantId: string; correlationId: string; policyVersion: string },
  rawText: string,
  sanitizedText: string,
): void {
  if (typeof receipt !== "object" || receipt === null) {
    failClosed("SCAN_RECEIPT_INVALID", "Scanner port returned no receipt. Failing closed.");
  }
  if (receipt.scan?.mode !== "raw") {
    failClosed(
      "SCAN_RECEIPT_INVALID",
      `Scan mode must be MVP raw-only (got ${JSON.stringify(receipt.scan?.mode)}). Failing closed.`,
    );
  }
  if (receipt.scan?.provenance !== "caller_supplied") {
    failClosed(
      "SCAN_RECEIPT_INVALID",
      `Scan provenance must be caller_supplied (got ${JSON.stringify(receipt.scan?.provenance)}). Failing closed.`,
    );
  }
  if (!isNonEmpty(receipt.scan?.policyVersion)) {
    failClosed("SCAN_RECEIPT_INVALID", "Scan receipt carries no policy version. Failing closed.");
  }
  if (receipt.scan.policyVersion !== request.policyVersion) {
    failClosed(
      "SCAN_RECEIPT_MISMATCH",
      `Scan policy version mismatch (want ${request.policyVersion}, got ${receipt.scan.policyVersion}). Failing closed.`,
    );
  }
  if (!SCAN_SEVERITIES.includes(receipt.severity)) {
    failClosed(
      "SCAN_RECEIPT_INVALID",
      `Unknown scan severity ${JSON.stringify(receipt.severity)}. Failing closed.`,
    );
  }
  if (!SCAN_INGESTION_HINTS.includes(receipt.ingestionHint)) {
    failClosed(
      "SCAN_RECEIPT_INVALID",
      `Unknown ingestion hint ${JSON.stringify(receipt.ingestionHint)}. Failing closed.`,
    );
  }
  // Contract invariant: fail_closed implies a high/critical severity band.
  if (
    receipt.ingestionHint === "fail_closed" &&
    receipt.severity !== "high" &&
    receipt.severity !== "critical"
  ) {
    failClosed(
      "SCAN_RECEIPT_INVALID",
      `ingestionHint fail_closed with severity ${receipt.severity} violates the ScanReceipt contract. Failing closed.`,
    );
  }
  if (
    !/^sha256:[a-f0-9]{64}$/.test(receipt.sanitizedBundleHash ?? "") ||
    !/^sha256:[a-f0-9]{64}$/.test(receipt.rawContentHash ?? "")
  ) {
    failClosed("SCAN_RECEIPT_INVALID", "Scan receipt bundle hashes are malformed. Failing closed.");
  }
  if (!/^[a-f0-9]{64}$/.test(receipt.canonicalSha256 ?? "")) {
    failClosed("SCAN_RECEIPT_INVALID", "Scan receipt canonical hash is malformed. Failing closed.");
  }
  if (receipt.tenantId !== request.tenantId || receipt.correlationId !== request.correlationId) {
    failClosed(
      "SCAN_RECEIPT_MISMATCH",
      "Scan receipt tenant/correlation does not match the request. Refusing cross-request scan state.",
    );
  }
  if (receipt.signature !== null && receipt.signature !== undefined) {
    if (
      typeof receipt.signature !== "object" ||
      !isNonEmpty(receipt.signature.algorithm) ||
      !isNonEmpty(receipt.signature.value)
    ) {
      failClosed("SCAN_RECEIPT_INVALID", "Scan receipt signature is malformed. Failing closed.");
    }
  }
  if (!isNonEmpty(receipt.scannedAtUtc) || Number.isNaN(Date.parse(receipt.scannedAtUtc))) {
    failClosed("SCAN_RECEIPT_INVALID", "Scan receipt timestamp is missing or invalid. Failing closed.");
  }
  // Bind the bundle bytes to the receipt: only the exact sanitized bytes the
  // receipt hashes may ingest, and only the exact raw bytes that were sent.
  if (sha256Uri(sanitizedText) !== receipt.sanitizedBundleHash) {
    failClosed(
      "SCAN_RECEIPT_MISMATCH",
      "Sanitized bytes do not match the receipt sanitizedBundleHash. Failing closed.",
    );
  }
  if (sha256Uri(rawText) !== receipt.rawContentHash) {
    failClosed(
      "SCAN_RECEIPT_MISMATCH",
      "Raw bytes do not match the receipt rawContentHash. Failing closed.",
    );
  }
}

/**
 * Scan caller-supplied content through the injected port (stub now, gateway
 * later). MVP raw-only: url-bearing or fetched-provenance requests fail
 * closed with SCAN_URL_FETCH_NOT_ENABLED — no fetching happens here.
 */
export async function requestScan(
  request: ScanRequest,
  scannerPort: ScannerPort,
): Promise<ScanIntakeOutcome> {
  if (!isNonEmpty(request.tenantId) || !isNonEmpty(request.actorId) || !isNonEmpty(request.correlationId)) {
    failClosed("SCAN_INVALID_REQUEST", "Scan requires tenantId, actorId, and correlationId. Failing closed.");
  }
  if (request.url !== undefined || request.provenance === "fetched") {
    failClosed(
      "SCAN_URL_FETCH_NOT_ENABLED",
      "MVP scan is raw-only over caller-supplied bytes: url/provenance=fetched requests fail closed (no live gateway, no URL fetching here).",
    );
  }
  if (request.provenance !== undefined && request.provenance !== "caller_supplied") {
    failClosed(
      "SCAN_INVALID_REQUEST",
      `Unknown scan provenance ${JSON.stringify(request.provenance)}. Failing closed.`,
    );
  }
  if (typeof request.content !== "string" || request.content.length === 0) {
    failClosed("SCAN_INVALID_REQUEST", "Scan requires non-empty caller-supplied content. Failing closed.");
  }
  if (!scannerPort || typeof scannerPort.scan !== "function") {
    failClosed("SCAN_INVALID_REQUEST", "Scan requires an injected scanner port. Failing closed.");
  }

  const policyVersion = request.policyVersion ?? SCAN_POLICY_VERSION;
  const raw = makeRawContent(request.content);
  const output = await scannerPort.scan({
    raw,
    tenantId: request.tenantId,
    actorId: request.actorId,
    correlationId: request.correlationId,
    policyVersion,
  });
  if (typeof output?.sanitizedText !== "string") {
    failClosed("SCAN_RECEIPT_INVALID", "Scanner port returned no sanitized text. Failing closed.");
  }
  validateReceipt(
    output.receipt,
    { tenantId: request.tenantId, correlationId: request.correlationId, policyVersion },
    request.content,
    output.sanitizedText,
  );

  const { receipt } = output;
  const refs = scanReceiptRefs(receipt);
  // Quarantine on high/critical: fail_closed blocks the dependent effect;
  // quarantine holds for review. Either way nothing ingests: bundle is null.
  if (receipt.ingestionHint === "fail_closed" || receipt.severity === "high" || receipt.severity === "critical") {
    const reason =
      `Scan blocked ingestion: severity=${receipt.severity} ingestionHint=${receipt.ingestionHint} ` +
      `sanitizedBundleHash=${refs.sanitizedBundleHash} rawContentHash=${refs.rawContentHash} ` +
      `canonicalSha256=${refs.canonicalSha256} correlationId=${refs.correlationId}.`;
    return { receipt, bundle: null, blocked: true, blockReason: reason, blockCode: "SCAN_BLOCKED_FAIL_CLOSED" };
  }
  if (receipt.ingestionHint === "quarantine") {
    const reason =
      `Scan quarantined ingestion for review: severity=${receipt.severity} ` +
      `sanitizedBundleHash=${refs.sanitizedBundleHash} canonicalSha256=${refs.canonicalSha256} ` +
      `correlationId=${refs.correlationId}.`;
    return { receipt, bundle: null, blocked: true, blockReason: reason, blockCode: "SCAN_QUARANTINED" };
  }

  return {
    receipt,
    bundle: {
      kind: "sanitized",
      text: output.sanitizedText,
      sanitizedBundleHash: receipt.sanitizedBundleHash,
      rawContentHash: receipt.rawContentHash,
      canonicalSha256: receipt.canonicalSha256,
      tenantId: receipt.tenantId,
      correlationId: receipt.correlationId,
      [sanitizedBrand]: true as const,
    },
    blocked: false,
  };
}

/**
 * Return ONLY the sanitized bundle (or null when blocked). The return type
 * cannot represent raw content: callers can only ingest what this returns.
 */
export function ingestibleBundle(outcome: ScanIntakeOutcome): SanitizedBundle | null {
  if (outcome.blocked || outcome.bundle === null) return null;
  return outcome.bundle;
}

/** Like ingestibleBundle, but throws fail-closed instead of returning null. */
export function requireIngestibleBundle(outcome: ScanIntakeOutcome): SanitizedBundle {
  const bundle = ingestibleBundle(outcome);
  if (bundle === null) {
    failClosed(
      outcome.blockCode ?? "SCAN_BLOCKED_FAIL_CLOSED",
      outcome.blockReason ?? "Scan blocked ingestion. Failing closed.",
    );
  }
  return bundle;
}

/**
 * The ONLY way to turn a bundle into persistable evidence text. Accepts
 * SanitizedBundle exclusively at the type level; the runtime kind check
 * additionally fails closed (SCAN_RAW_NOT_INGESTIBLE) for untyped callers
 * passing raw content, plain strings, or forged objects — raw excerpts must
 * never persist where only sanitized belongs.
 */
export function toIngestibleEvidence(bundle: SanitizedBundle): string {
  if (
    typeof bundle !== "object" ||
    bundle === null ||
    (bundle as { kind?: unknown }).kind !== "sanitized" ||
    typeof (bundle as { text?: unknown }).text !== "string"
  ) {
    failClosed(
      "SCAN_RAW_NOT_INGESTIBLE",
      "Only a sanitized bundle may become ingestible evidence; raw content is unrepresentable here. Failing closed.",
    );
  }
  return bundle.text;
}

/** Hash-only refs to record alongside sourced material (ingest + quarantine). */
export function scanReceiptRefs(receipt: ScanReceipt): ScanReceiptRefs {
  return {
    sanitizedBundleHash: receipt.sanitizedBundleHash,
    rawContentHash: receipt.rawContentHash,
    canonicalSha256: receipt.canonicalSha256,
    tenantId: receipt.tenantId,
    correlationId: receipt.correlationId,
    severity: receipt.severity,
    ingestionHint: receipt.ingestionHint,
    scannedAtUtc: receipt.scannedAtUtc,
  };
}

/** True when the outcome must not ingest (high/critical or non-allow hint). */
export function isBlockedOutcome(outcome: ScanIntakeOutcome): boolean {
  return outcome.blocked || outcome.bundle === null;
}
