# Parcels — marketops-keon-integration

| Parcel | Wave | Branch | Worktree | Status | Collision |
|---|---|---|---|---|---|
| k0-contracts-keon | K0 | feat/k0-contracts-keon | (pruned) | merged (#40, JOINT-REVIEW: PASS) | Low |
| k0-spike-gateway-roundtrip | K0 | feat/k0-spike-gateway-roundtrip | (pruned) | merged (#42, 73 assertions, FIT for K1) | Low |
| k1-gateway-client | K1 | feat/k1-gateway-client | C:\Repos\MarketOps.k1-gateway-client | in-review (#44, 29 tests) | Low |
| k1-browseahead-intake | K1 | feat/k1-browseahead-intake | C:\Repos\MarketOps.k1-browseahead-intake | in-review (#46, 9 tests, full green) | Low |
| k1-context-conformance | K1 | feat/k1-context-conformance | C:\Repos\MarketOps.k1-context-conformance | in-review (#45, 8 tests) | Low |

## Dependency graph
CHARTER (#39) → k0-contracts-keon → k0-spike → K1 (S8, S13, S12 parallel) → K2 (S10 → S11 → h-evidence-seal, serialized) → K3 (S9 beta-live → INT-keon) → Milestone-B packet.

## Joint-review record
- Round 1 (Grok, independent): FAIL — 9 findings (native PolicyDecision, ledger receiptClass/actorId/timestamp, camelCase domain, class catalog, sha256: encoding, no invented Decide API, distinct markers).
- Remediation on same branch (8aa7ebf, 21→37 tests).
- Round 2 (Grok, independent): PASS 9/9. Gate k-contracts-aligned passing. Merge call: user.

## Collision-risk files
contracts/Keon*.json + DeliberationCandidate/ScanReceipt/LedgerEntry (new, no collision); src/lib/keon/** (new); tests/contracts/keon-contracts.test.ts + fixtures/keon/** (new).
