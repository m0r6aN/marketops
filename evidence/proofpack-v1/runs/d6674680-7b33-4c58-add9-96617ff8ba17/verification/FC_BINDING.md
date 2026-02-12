# FC Binding Verification

**Run:** `d6674680-7b33-4c58-add9-96617ff8ba17`
**Scenario:** 01-hygiene-sweep
**Verified:** 2026-02-12T03:29:40.1289133+00:00
**Verdict:** `fc_bound`

## Results: 7/7 passed

| # | Check | Result | Expected | Actual |
|---|-------|--------|----------|--------|
| 1 | Advisory receipt is present | ✅ | `non-null` | `advr_45c15a12` |
| 2 | Receipt minted by Federation Core | ✅ | `federation-core` | `federation-core` |
| 3 | receipt.runId matches run | ✅ | `d6674680-7b33-4c58-add9-96617ff8...` | `d6674680-7b33-4c58-add9-96617ff8...` |
| 4 | receipt.planSha256 matches hash(publication-plan) | ✅ | `b0a82249009d62047a9336d29d24c19c...` | `b0a82249009d62047a9336d29d24c19c...` |
| 5 | receipt.ledgerSha256 matches hash(proof-ledger) | ✅ | `62620cdafbeeb0d2c7e0356bd75def56...` | `62620cdafbeeb0d2c7e0356bd75def56...` |
| 6 | HMAC-SHA256 signature valid | ✅ | `valid` | `valid` |
| 7 | Ledger references receipt (receiptId + receiptDigest) | ✅ | `advr_45c15a12` | `advr_45c15a12` |

> **All FC binding checks passed.** This run's governance artifacts are cryptographically bound to Federation Core authority.
