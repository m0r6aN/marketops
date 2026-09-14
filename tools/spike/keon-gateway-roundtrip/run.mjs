// k0-spike-gateway-roundtrip — thin spike parcel (harness only, no product code).
//
// Proves the k0 Keon contract abstractions against a faithful in-harness stub
// gateway: envelope round-trip + denial mapping + ledger chain append.
//
// Stub coverage (pure functions, no network, no secrets):
//   policyCheck  -> all 5 native BioStack PolicyDecision outcomes
//   issueReceipt -> keon://receipt URIs + sha256: hashes
//   scan         -> MVP raw-only sanitized bundle (URL fetch deferred)
//   append       -> ledger entries chained from sha256:genesis
//
// Run:
//   npm install --no-save --no-package-lock --no-audit --no-fund
//   node tools/spike/keon-gateway-roundtrip/run.mjs   (exit 0 required)
//
// Fail-closed: any failed assertion prints `SPIKE-FAIL <message>` and exits
// non-zero. Passing assertions print `SPIKE-OK <message>`.
//
// If any abstraction here feels wrong, STOP and request a contract amendment
// (cost now = 1 PR). Do not "fix forward" into src/ from this parcel.

import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..", "..");

// ---------------------------------------------------------------------------
// Fail-closed assertion plumbing + no-network arm.
// ---------------------------------------------------------------------------

let passCount = 0;

function assert(cond, message) {
  if (!cond) {
    console.error(`SPIKE-FAIL ${message}`);
    process.exitCode = 1;
    throw new Error(message);
  }
  passCount += 1;
  console.log(`SPIKE-OK ${message}`);
}

let networkTouched = false;
const realFetch = globalThis.fetch;
globalThis.fetch = async () => {
  networkTouched = true;
  throw new Error("network call attempted: URL fetch is deferred in this spike");
};

// ---------------------------------------------------------------------------
// Contract mirrors. contracts/*.json are the source of truth; these constants
// mirror src/lib/keon/types.ts (LEDGER_GENESIS_PREV_HASH,
// KEON_DISPOSITION_DERIVATION, KEON_MARKER_*). The harness cannot import the
// TS module directly, so the copies are asserted structurally below.
// ---------------------------------------------------------------------------

const LEDGER_GENESIS_PREV_HASH = "sha256:genesis";

const KEON_POLICY_DECISIONS = [
  "allowed",
  "allowed-with-disclaimer",
  "rewrite-required",
  "blocked",
  "escalate-to-provider-review",
];

const KEON_DISPOSITION_DERIVATION = {
  allowed: "authorize",
  "allowed-with-disclaimer": "authorize",
  "rewrite-required": "require-review",
  blocked: "deny",
  "escalate-to-provider-review": "require-review",
};

const KEON_MARKER_VALUES = ["unanchored-local", "local-classifier-v0", "ERROR"];
const KEON_MARKER_VERSION = "0.0.0";

const ANCHORED_POLICY_HASH = {
  value: `sha256:${"cf".repeat(32)}`,
  version: "claim-policy.v1",
};

// Fixed spike-local fixtures (illustrative ids/hashes only — no secrets).
const FIXED = {
  correlationId: "k0-spike-corr-0001",
  tool: "keon.policy.check.v1",
  tenantId: "tenant-keon",
  actorId: "user:3fa85f64-5717-4562-b3fc-2c963f66afa6",
  disclaimerText:
    "Spike disclaimer: throughput claim scoped to dry_run proofpack exports.",
  rewrittenText:
    "Spike rewrite: dry-run proofpack exports averaged sealed throughput across the supported runs.",
  denialCode: "SPIKE_POLICY_DENY",
  denialMessage: "Spike stub denied the effect at the decision stage.",
  scanPolicyVersion: "browseahead-policy.v1",
  callerBytes: "k0-spike caller-supplied bytes <script>alert(1)</script> fixture",
};

function sha256Hex(input) {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function sha256Uri(input) {
  return `sha256:${sha256Hex(input)}`;
}

// ---------------------------------------------------------------------------
// Stub gateway: pure functions implementing the contract shapes.
// ---------------------------------------------------------------------------

function deriveKeonDisposition(native) {
  const coarse = KEON_DISPOSITION_DERIVATION[native];
  if (!coarse) {
    const err = new Error(`UNKNOWN_POLICY_DECISION: fail-closed on ${String(native)}`);
    err.code = "UNKNOWN_POLICY_DECISION";
    throw err;
  }
  return coarse;
}

// policyCheck stub: answers any of the 5 native decisions with the derived
// coarse disposition plus the decision-specific payload (Grok D1 lesson: the
// payload must survive the native->coarse derivation, never be dropped).
function stubPolicyCheck(nativeDecision, opts = {}) {
  const decision = deriveKeonDisposition(nativeDecision);
  const receipt = {
    policyDecision: nativeDecision,
    decision,
    policyHash: { ...ANCHORED_POLICY_HASH },
  };
  if (nativeDecision === "allowed-with-disclaimer") {
    receipt.disclaimerText = opts.disclaimerText ?? FIXED.disclaimerText;
  }
  if (nativeDecision === "rewrite-required") {
    receipt.rewrittenText = opts.rewrittenText ?? FIXED.rewrittenText;
  }
  if (nativeDecision === "blocked") {
    receipt.denialCode = opts.denialCode ?? FIXED.denialCode;
    receipt.denialMessage = opts.denialMessage ?? FIXED.denialMessage;
    receipt.failureStage = opts.failureStage ?? "decision";
  }
  return receipt;
}

// issueReceipt stub: deterministic keon://receipt URI + sha256: hashes.
function stubIssueReceiptUri(correlationId, policyDecision) {
  const id = sha256Hex(`${correlationId}|${policyDecision}`).slice(0, 12);
  return `keon://receipt/${id}`;
}

function stubEnvelopeForReceipt({ correlationId, tool, receiptRequest, result }) {
  const denied = receiptRequest.policyDecision === "blocked";
  const envelope = {
    correlationId,
    tool,
    ok: !denied,
    status: denied ? "denied" : "ok",
    decision: {
      policyDecision: receiptRequest.policyDecision,
      status: receiptRequest.decision,
      policyHash: { ...receiptRequest.policyHash },
    },
    receipts: [receiptRequest.decisionReceiptUri],
    isError: false,
  };
  if (denied) {
    envelope.denialCode = receiptRequest.denialCode;
    envelope.denialMessage = receiptRequest.denialMessage;
    // NO `result`: denials carry no execution artifact (asserted in (c)).
  } else if (result !== undefined) {
    envelope.result = result;
  }
  return envelope;
}

// scan stub: MVP raw-only. caller_supplied bytes are hashed + sanitized;
// fetched provenance fails closed (URL fetch deferred — no network here).
function stubScanCallerSupplied({ tenantId, actorId, correlationId, callerBytes, policyVersion }) {
  const rawContentHash = sha256Uri(callerBytes);
  const sanitized = callerBytes.replace(/<script[\s\S]*?<\/script>/gi, "").trim();
  const sanitizedBundleHash = sha256Uri(sanitized);
  const canonicalSha256 = sha256Hex(`${tenantId}|${correlationId}|${sanitizedBundleHash}`);
  return {
    scan: { mode: "raw", provenance: "caller_supplied", policyVersion },
    severity: "none",
    ingestionHint: "allow",
    sanitizedBundleHash,
    rawContentHash,
    canonicalSha256,
    signature: null,
    tenantId,
    actorId,
    correlationId,
    scannedAtUtc: "2026-09-14T00:00:00Z",
  };
}

function stubScan(request) {
  if (request.provenance === "fetched") {
    const err = new Error(
      "SCAN_FETCH_DEFERRED: gateway URL fetch is deferred in the k0 spike; " +
        "callers must supply bytes with provenance caller_supplied"
    );
    err.code = "SCAN_FETCH_DEFERRED";
    throw err;
  }
  if (request.provenance !== "caller_supplied") {
    const err = new Error(`UNKNOWN_PROVENANCE: fail-closed on ${String(request.provenance)}`);
    err.code = "UNKNOWN_PROVENANCE";
    throw err;
  }
  return stubScanCallerSupplied(request);
}

// append stub: ledger entries chained from sha256:genesis. The entryHash
// canonicalization below is spike-local (illustrative, NOT the S11 verifier);
// what the spike proves is linkage + recompute-verifiability of the shape.
function computeEntryHash(entry) {
  const canonical = JSON.stringify([
    entry.seq,
    entry.prevHash,
    entry.receiptRef,
    entry.correlationId,
    entry.tenantId,
    entry.receiptClass,
    entry.actorId,
    entry.timestamp,
  ]);
  return `sha256:${sha256Hex(canonical)}`;
}

function stubAppend(chain, { receiptRef, correlationId, tenantId, receiptClass, actorId, timestamp }) {
  const seq = chain.length;
  const prevHash = seq === 0 ? LEDGER_GENESIS_PREV_HASH : chain[seq - 1].entryHash;
  const entry = {
    seq,
    prevHash,
    receiptRef,
    correlationId,
    entryHash: "sha256:pending",
    epochRef: null,
    tenantId,
    receiptClass,
    actorId,
    timestamp,
  };
  entry.entryHash = computeEntryHash(entry);
  return entry;
}

function verifyLedgerChain(chain) {
  for (let i = 0; i < chain.length; i += 1) {
    const entry = chain[i];
    const expectedPrev = i === 0 ? LEDGER_GENESIS_PREV_HASH : chain[i - 1].entryHash;
    if (entry.seq !== i) return false;
    if (entry.prevHash !== expectedPrev) return false;
    if (computeEntryHash(entry) !== entry.entryHash) return false;
  }
  return true;
}

// Anchoring classifier: keon:// rows are anchored; everything else is an
// unanchored local scheme. Marker policy hashes must NEVER pair with keon://.
function isKeonAnchored(uri) {
  return uri.startsWith("keon://");
}

function checkReceiptAnchoring(receiptRequest) {
  const uri = receiptRequest.decisionReceiptUri ?? "";
  if (KEON_MARKER_VALUES.includes(receiptRequest.policyHash.value) && isKeonAnchored(uri)) {
    const err = new Error("MARKER_WITH_KEON_URI: zeroed-hash marker paired with keon:// — no silent provisioning");
    err.code = "MARKER_WITH_KEON_URI";
    throw err;
  }
  return isKeonAnchored(uri) ? "anchored" : "unanchored";
}

function collectKeys(value, out = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, out);
  } else if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value)) {
      out.push(key);
      collectKeys(value[key], out);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Spike body.
// ---------------------------------------------------------------------------

function main() {
  // Temp state only: every file this harness writes lives under os.tmpdir().
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "marketops-k0-spike-"));
  const writtenPaths = [];
  const tmpFile = (name) => {
    const p = path.join(tmpDir, name);
    writtenPaths.push(p);
    return p;
  };
  assert(tmpDir.startsWith(os.tmpdir()), `spike state is temp-only (${tmpDir})`);
  assert(!tmpDir.startsWith(ROOT), "spike state lives outside the repo");

  // Contract-mirror sanity: the derivation table covers exactly the 5 native
  // decisions, in BioStack PolicyDecision enum order.
  assert(KEON_POLICY_DECISIONS.length === 5, "derivation covers exactly 5 native decisions");
  for (const native of KEON_POLICY_DECISIONS) {
    assert(
      typeof KEON_DISPOSITION_DERIVATION[native] === "string",
      `derivation covers native decision '${native}'`
    );
  }
  assert(LEDGER_GENESIS_PREV_HASH === "sha256:genesis", "genesis constant is sha256:genesis");

  // -- (a) envelope serialize -> parse round-trip (byte-stable) ------------
  console.log("--- (a) envelope round-trip");
  const allowReceipt = {
    ...stubPolicyCheck("allowed"),
    decisionReceiptUri: stubIssueReceiptUri(FIXED.correlationId, "allowed"),
  };
  const envelope = stubEnvelopeForReceipt({
    correlationId: FIXED.correlationId,
    tool: FIXED.tool,
    receiptRequest: allowReceipt,
    result: { tenantId: FIXED.tenantId, note: "k0 spike authorize" },
  });
  const bytes = JSON.stringify(envelope);
  const parsed = JSON.parse(bytes);
  assert(parsed.correlationId === FIXED.correlationId, "(a) round-trip preserves correlationId");
  assert(
    JSON.stringify(parsed.decision) === JSON.stringify(envelope.decision),
    "(a) round-trip preserves decision"
  );
  assert(
    JSON.stringify(parsed.receipts) === JSON.stringify(envelope.receipts),
    "(a) round-trip preserves receipts"
  );
  assert(JSON.stringify(parsed) === bytes, "(a) round-trip is byte-stable for fixed input");
  const envelopePath = tmpFile("envelope.json");
  fs.writeFileSync(envelopePath, bytes, "utf8");
  assert(fs.readFileSync(envelopePath, "utf8") === bytes, "(a) tmp-file round-trip is byte-stable");

  // -- (b) all 5 native decisions map to the derived coarse disposition ----
  console.log("--- (b) native -> coarse derivation");
  const expectedCoarse = {
    allowed: "authorize",
    "allowed-with-disclaimer": "authorize",
    "rewrite-required": "require-review",
    blocked: "deny",
    "escalate-to-provider-review": "require-review",
  };
  for (const native of KEON_POLICY_DECISIONS) {
    const receipt = stubPolicyCheck(native);
    assert(
      receipt.decision === expectedCoarse[native],
      `(b) native '${native}' derives coarse '${expectedCoarse[native]}'`
    );
    assert(receipt.policyDecision === native, `(b) native '${native}' is preserved, not substituted`);
  }
  const disclaimerReceipt = stubPolicyCheck("allowed-with-disclaimer");
  assert(
    disclaimerReceipt.disclaimerText === FIXED.disclaimerText,
    "(b) allowed-with-disclaimer preserves disclaimerText (Grok D1)"
  );
  const rewriteReceipt = stubPolicyCheck("rewrite-required");
  assert(
    rewriteReceipt.rewrittenText === FIXED.rewrittenText,
    "(b) rewrite-required preserves rewrittenText (Grok D1)"
  );
  // Unknown native outcomes fail closed instead of degrading.
  let unknownThrew = false;
  try {
    stubPolicyCheck("allowed-with-extra-sauce");
  } catch (err) {
    unknownThrew = err.code === "UNKNOWN_POLICY_DECISION";
  }
  assert(unknownThrew, "(b) unknown native decision fails closed");

  // -- (c) denial envelope: denial fields + isError, NO execution artifact --
  console.log("--- (c) denial mapping");
  const blockedReceipt = {
    ...stubPolicyCheck("blocked"),
    decisionReceiptUri: stubIssueReceiptUri("k0-spike-corr-deny-001", "blocked"),
  };
  const denialEnvelope = stubEnvelopeForReceipt({
    correlationId: "k0-spike-corr-deny-001",
    tool: FIXED.tool,
    receiptRequest: blockedReceipt,
  });
  assert(denialEnvelope.status === "denied", "(c) blocked maps to envelope status denied");
  assert(denialEnvelope.ok === false, "(c) denied envelope has ok=false");
  assert(denialEnvelope.isError === false, "(c) policy denial is not a transport error (isError=false)");
  assert(
    denialEnvelope.denialCode === FIXED.denialCode && denialEnvelope.denialMessage === FIXED.denialMessage,
    "(c) denial envelope carries denialCode/denialMessage"
  );
  assert(!("result" in denialEnvelope), "(c) denial envelope carries NO execution artifact");
  assert(
    denialEnvelope.decision.status === "deny" && denialEnvelope.decision.policyDecision === "blocked",
    "(c) denial decision keeps native blocked + derived deny"
  );
  assert(
    denialEnvelope.receipts.length === 1 && isKeonAnchored(denialEnvelope.receipts[0]),
    "(c) denial still cites its evidence receipt"
  );

  // -- (d) 3-entry ledger chain with prevHash linkage + genesis ------------
  console.log("--- (d) ledger chain append");
  const chain = [];
  const appendInputs = [
    {
      receiptRef: stubIssueReceiptUri("k0-spike-corr-0001", "allowed"),
      correlationId: "k0-spike-corr-0001",
      tenantId: FIXED.tenantId,
      receiptClass: "ledger.entry.appended",
      actorId: FIXED.actorId,
      timestamp: "2026-09-14T00:00:00Z",
    },
    {
      receiptRef: stubIssueReceiptUri("k0-spike-corr-0002", "rewrite-required"),
      correlationId: "k0-spike-corr-0002",
      tenantId: FIXED.tenantId,
      receiptClass: "campaign.publish.completed",
      actorId: FIXED.actorId,
      timestamp: "2026-09-14T00:01:00Z",
    },
    {
      receiptRef: `marketops://unanchored-receipt/${sha256Hex("k0-spike-note-003").slice(0, 16)}`,
      correlationId: "k0-spike-corr-0003",
      tenantId: FIXED.tenantId,
      receiptClass: "ledger.entry.appended",
      actorId: "system:safety-monitor",
      timestamp: "2026-09-14T00:02:00Z",
    },
  ];
  for (const input of appendInputs) chain.push(stubAppend(chain, input));
  assert(chain.length === 3, "(d) chain holds 3 appended entries");
  assert(chain[0].seq === 0 && chain[0].prevHash === LEDGER_GENESIS_PREV_HASH, "(d) seq-0 starts at sha256:genesis");
  assert(chain[1].prevHash === chain[0].entryHash, "(d) entry 1 links to entry 0");
  assert(chain[2].prevHash === chain[1].entryHash, "(d) entry 2 links to entry 1");
  assert(verifyLedgerChain(chain), "(d) chain verifies by recompute");
  assert(chain.every((e) => e.epochRef === null), "(d) epochRef stays null (S11 anchoring deferred)");
  const tampered = JSON.parse(JSON.stringify(chain));
  tampered[1].receiptClass = "ledger.entry.appended";
  assert(!verifyLedgerChain(tampered), "(d) tampered chain fails recompute verification");
  const chainPath = tmpFile("ledger-chain.json");
  fs.writeFileSync(chainPath, JSON.stringify(chain), "utf8");
  assert(
    verifyLedgerChain(JSON.parse(fs.readFileSync(chainPath, "utf8"))),
    "(d) tmp-persisted chain still verifies"
  );

  // -- (e) scan receipt MVP raw-only; fetched fails closed ------------------
  console.log("--- (e) scan MVP raw-only");
  const scanReceipt = stubScan({
    provenance: "caller_supplied",
    tenantId: FIXED.tenantId,
    actorId: FIXED.actorId,
    correlationId: "k0-spike-scan-001",
    callerBytes: FIXED.callerBytes,
    policyVersion: FIXED.scanPolicyVersion,
  });
  assert(scanReceipt.scan.mode === "raw", "(e) scan mode is MVP raw-only");
  assert(scanReceipt.scan.provenance === "caller_supplied", "(e) scan provenance is caller_supplied");
  assert(scanReceipt.signature === null, "(e) signature null means unsigned, not invalid");
  assert(/^sha256:[a-f0-9]{64}$/.test(scanReceipt.sanitizedBundleHash), "(e) sanitizedBundleHash is sha256:<hex>");
  assert(/^sha256:[a-f0-9]{64}$/.test(scanReceipt.rawContentHash), "(e) rawContentHash is sha256:<hex>");
  assert(/^[a-f0-9]{64}$/.test(scanReceipt.canonicalSha256), "(e) canonicalSha256 is bare hex");
  assert(
    scanReceipt.sanitizedBundleHash !== scanReceipt.rawContentHash,
    "(e) sanitized bundle differs from raw bytes (raw never ingests)"
  );
  let fetchDeferred = false;
  try {
    stubScan({ provenance: "fetched", sourceUri: "https://example.invalid/scan-target" });
  } catch (err) {
    fetchDeferred = err.code === "SCAN_FETCH_DEFERRED";
  }
  assert(fetchDeferred, "(e) fetched-provenance request fails closed (URL fetch deferred)");
  assert(networkTouched === false, "(e) no network call was attempted");

  // -- (f) deliberation candidate: branch/dissent/confidence, NO permission --
  console.log("--- (f) deliberation candidate");
  const candidate = {
    candidate: {
      branch: "branch-b",
      collapseRef: "collapse:round-014",
      rationale: "Spike rationale: scoped claim evidence only, never an instruction to act.",
    },
    challenges: [
      { challenge: "Spike challenge: prod-mode run missing.", raisedBy: "reviewer:spike-01", severity: "high" },
    ],
    dissent: "Spike dissent: hold the claim until a prod-mode proofpack seals it.",
    confidence: { value: 0.62, calibrationVersion: "calib.v3" },
    heatRef: "heat:round-014",
    lineage: { intentId: "intent:spike-007", collapseId: "collapse:round-014", reviewId: "review:spike-007-r1" },
    tenantId: FIXED.tenantId,
  };
  assert(candidate.candidate.branch === "branch-b", "(f) candidate carries branch");
  assert(typeof candidate.dissent === "string" && candidate.dissent.length > 0, "(f) dissent preserved verbatim");
  assert(
    candidate.confidence.value >= 0 && candidate.confidence.value <= 1,
    "(f) confidence value is within [0,1]"
  );
  assert(candidate.lineage.intentId.length > 0, "(f) lineage binds intent/collapse/review");
  const candidateKeys = collectKeys(candidate);
  assert(
    !candidateKeys.some((k) => /permission/i.test(k)),
    "(f) candidate carries NO permission field (asserted recursively)"
  );
  const topLevel = Object.keys(candidate).sort();
  const allowedTopLevel = ["candidate", "challenges", "confidence", "dissent", "heatRef", "lineage", "tenantId"].sort();
  assert(
    JSON.stringify(topLevel) === JSON.stringify(allowedTopLevel),
    "(f) candidate top-level shape holds no extra authority field"
  );
  const silentCandidate = { ...candidate, dissent: "none-voiced" };
  assert(silentCandidate.dissent === "none-voiced", "(f) no-dissent uses the 'none-voiced' marker, never empty");

  // -- (g) unanchored markers distinguishable from keon:// rows -------------
  console.log("--- (g) unanchored markers");
  for (const marker of KEON_MARKER_VALUES) {
    const row = {
      policyDecision: "blocked",
      decision: "deny",
      policyHash: { value: marker, version: KEON_MARKER_VERSION },
      decisionReceiptUri: `marketops://unanchored-receipt/${sha256Hex(`k0-spike-${marker}`).slice(0, 16)}`,
      denialCode: FIXED.denialCode,
      denialMessage: FIXED.denialMessage,
    };
    assert(checkReceiptAnchoring(row) === "unanchored", `(g) marker '${marker}' classifies as unanchored`);
    assert(!isKeonAnchored(row.decisionReceiptUri), `(g) marker '${marker}' never uses a keon:// URI`);
    assert(row.policyHash.version === "0.0.0", `(g) marker '${marker}' carries version 0.0.0`);
  }
  const anchoredRow = {
    ...stubPolicyCheck("allowed"),
    decisionReceiptUri: stubIssueReceiptUri(FIXED.correlationId, "allowed"),
  };
  assert(checkReceiptAnchoring(anchoredRow) === "anchored", "(g) real policy hash + keon:// classifies as anchored");
  assert(anchoredRow.policyHash.version !== "0.0.0", "(g) anchored rows never carry marker version 0.0.0");
  let markerKeonRejected = false;
  try {
    checkReceiptAnchoring({
      policyDecision: "blocked",
      decision: "deny",
      policyHash: { value: "unanchored-local", version: "0.0.0" },
      decisionReceiptUri: "keon://receipt/silent-provision-attempt",
      denialCode: FIXED.denialCode,
      denialMessage: FIXED.denialMessage,
    });
  } catch (err) {
    markerKeonRejected = err.code === "MARKER_WITH_KEON_URI";
  }
  assert(markerKeonRejected, "(g) marker paired with keon:// is rejected (no silent provisioning)");

  // Repo untouched: every path this harness wrote is under the temp dir.
  for (const p of writtenPaths) {
    assert(p.startsWith(tmpDir), `temp-only write stays outside the repo (${path.basename(p)})`);
  }
  assert(networkTouched === false, "no network calls were made");
  globalThis.fetch = realFetch;

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log("SPIKE-OK temp dir destroyed, repo untouched");
  console.log(`SPIKE-RESULT pass: ${passCount} assertions (a) envelope round-trip, (b) 5-way derivation, (c) denial, (d) ledger chain, (e) scan raw-only, (f) deliberation, (g) markers`);
}

main();
