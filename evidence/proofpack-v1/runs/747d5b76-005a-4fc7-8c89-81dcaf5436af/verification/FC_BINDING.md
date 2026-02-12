# FC Binding Verification

**Run:** `747d5b76-005a-4fc7-8c89-81dcaf5436af`
**Scenario:** 04-policy-violation-direct-push-main
**Verified:** 2026-02-12T03:29:40.0701492+00:00
**Verdict:** `fc_bound`

## Results: 7/7 passed

| # | Check | Result | Expected | Actual |
|---|-------|--------|----------|--------|
| 1 | Advisory receipt is present | ✅ | `non-null` | `advr_fe392404` |
| 2 | Receipt minted by Federation Core | ✅ | `federation-core` | `federation-core` |
| 3 | receipt.runId matches run | ✅ | `747d5b76-005a-4fc7-8c89-81dcaf54...` | `747d5b76-005a-4fc7-8c89-81dcaf54...` |
| 4 | receipt.planSha256 matches hash(publication-plan) | ✅ | `a96f2ab0f8bbb0272d4eb27897139503...` | `a96f2ab0f8bbb0272d4eb27897139503...` |
| 5 | receipt.ledgerSha256 matches hash(proof-ledger) | ✅ | `e5ffcbca466047904f9429bb84b1499a...` | `e5ffcbca466047904f9429bb84b1499a...` |
| 6 | HMAC-SHA256 signature valid | ✅ | `valid` | `valid` |
| 7 | Ledger references receipt (receiptId + receiptDigest) | ✅ | `advr_fe392404` | `advr_fe392404` |

> **All FC binding checks passed.** This run's governance artifacts are cryptographically bound to Federation Core authority.
