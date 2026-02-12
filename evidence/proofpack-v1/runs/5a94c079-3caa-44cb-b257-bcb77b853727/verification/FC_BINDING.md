# FC Binding Verification

**Run:** `5a94c079-3caa-44cb-b257-bcb77b853727`
**Scenario:** unknown
**Verified:** 2026-02-12T04:21:11.2191608+00:00
**Verdict:** `fc_bound`

## Results: 8/8 passed

| # | Check | Result | Expected | Actual |
|---|-------|--------|----------|--------|
| 1 | Advisory receipt is present | ✅ | `non-null` | `advr_c78f2010` |
| 2 | Receipt minted by Federation Core | ✅ | `federation-core` | `federation-core` |
| 3 | receipt.runId matches run | ✅ | `5a94c079-3caa-44cb-b257-bcb77b85...` | `5a94c079-3caa-44cb-b257-bcb77b85...` |
| 4 | receipt.planSha256 matches hash(publication-plan) | ✅ | `3e1c5c54fb54064f5a1bd3672720f067...` | `3e1c5c54fb54064f5a1bd3672720f067...` |
| 5 | receipt.ledgerSha256 matches hash(proof-ledger) | ✅ | `e12949a72bf52b9869891f8334ea9de6...` | `e12949a72bf52b9869891f8334ea9de6...` |
| 6 | HMAC-SHA256 signature valid | ✅ | `valid` | `valid` |
| 7 | Ledger references receipt (receiptId + receiptDigest) | ✅ | `advr_c78f2010` | `advr_c78f2010` |
| 8 | tenantId consistent across plan, ledger, receipt.subject | ✅ | `tenant-demo` | `tenant-demo` |

> **All FC binding checks passed.** This run's governance artifacts are cryptographically bound to Federation Core authority.
