# Spike: Keon gateway round-trip (k0-spike-gateway-roundtrip)

Thin spike proving the k0 Keon contract abstractions against a faithful
in-harness stub gateway. Harness only — no product code.

## Run

```sh
npm install --no-save --no-package-lock --no-audit --no-fund  # toolchain only, no git impact
node tools/spike/keon-gateway-roundtrip/run.mjs              # exit 0 required
npm run lint                                                  # must be clean
```

Expected: exit 0, `SPIKE-OK ...` lines, and
`SPIKE-RESULT pass: N assertions ...`.

## What it proves

a. Envelope serialize→parse round-trip preserves correlationId + decision +
   receipts (byte-stable for fixed input, in memory and via temp file).
b. All 5 native policy decisions map to the correct derived coarse
   disposition, with disclaimer/rewrite payloads preserved (Grok D1 lesson);
   unknown natives fail closed.
c. Denial envelopes carry denialCode/denialMessage with isError=false and NO
   execution artifact (`result` absent), while still citing the evidence
   receipt.
d. 3-entry ledger chain appends with prevHash linkage from `sha256:genesis`,
   verifiable by recompute (a tampered copy fails verification); epochRef
   stays null until S11 anchoring lands.
e. Scan receipt MVP raw-only: `fetched`-provenance requests fail closed
   (`SCAN_FETCH_DEFERRED`, no network — URL fetch deferred); only the
   sanitized bundle is ingestible, raw bytes never are.
f. Deliberation candidates carry branch/dissent/confidence (+lineage) and NO
   permission field (absence asserted recursively over all keys plus a
   top-level shape check); no-dissent uses the literal `none-voiced` marker.
g. Unanchored marker rows (`unanchored-local`, `local-classifier-v0`,
   `ERROR` @ `0.0.0` on a local scheme) are distinguishable from `keon://`
   rows — a marker paired with `keon://` is rejected fail-closed, so there is
   no silent provisioning.

All state lives in `os.tmpdir()` and is destroyed afterwards; the repo is
untouched. No network calls; no secrets.

## Stop-and-report

If any abstraction here feels wrong for K1, do NOT extend this harness into
product code — request a contract amendment first (cost now = 1 PR).

## Release gate

Records a pass for gate `k0-spike-ok` (new). Harness-only: full `npm test` /
`typecheck` / `build` are unaffected — no `src/**`, `contracts/**`,
`tests/**`, or package files changed, so their inputs are identical.
