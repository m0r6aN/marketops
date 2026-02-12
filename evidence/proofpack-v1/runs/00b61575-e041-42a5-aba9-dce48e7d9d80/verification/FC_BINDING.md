# FC Binding Verification

**Run:** `00b61575-e041-42a5-aba9-dce48e7d9d80`
**Scenario:** unknown
**Verified:** 2026-02-12T04:21:11.1850211+00:00
**Verdict:** `fc_bound`

## Results: 8/8 passed

| # | Check | Result | Expected | Actual |
|---|-------|--------|----------|--------|
| 1 | Advisory receipt is present | ✅ | `non-null` | `advr_689db081` |
| 2 | Receipt minted by Federation Core | ✅ | `federation-core` | `federation-core` |
| 3 | receipt.runId matches run | ✅ | `00b61575-e041-42a5-aba9-dce48e7d...` | `00b61575-e041-42a5-aba9-dce48e7d...` |
| 4 | receipt.planSha256 matches hash(publication-plan) | ✅ | `ad06b14c5dc3081921692914cd86e134...` | `ad06b14c5dc3081921692914cd86e134...` |
| 5 | receipt.ledgerSha256 matches hash(proof-ledger) | ✅ | `4c4e5ca2aebbb6e25b19b0f8722ec2d8...` | `4c4e5ca2aebbb6e25b19b0f8722ec2d8...` |
| 6 | HMAC-SHA256 signature valid | ✅ | `valid` | `valid` |
| 7 | Ledger references receipt (receiptId + receiptDigest) | ✅ | `advr_689db081` | `advr_689db081` |
| 8 | tenantId consistent across plan, ledger, receipt.subject | ✅ | `tenant-demo` | `tenant-demo` |

> **All FC binding checks passed.** This run's governance artifacts are cryptographically bound to Federation Core authority.
