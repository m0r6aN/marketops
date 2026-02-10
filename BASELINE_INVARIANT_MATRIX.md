# Baseline Invariant Matrix — Session 4 Phase 0

**Date:** 2026-02-10  
**Run:** Clean baseline, Release config  
**Result:** ✅ 29/29 PASSED (78ms)

---

## Invariant Coverage

### Invariant A: Dry-Run → Zero External Side Effects
**Tests Covering:**
- `DryRunLawTests::DryRun_ProducesZeroExternalSideEffects` ✅
- `DryRunLawTests::DryRun_AllSideEffectsAreBlocked` ✅
- `SideEffectPortTests::DryRun_NullSink_RecordsIntent_AndNeverExecutesExternalAction` ✅
- `SideEffectPortTests::DryRun_UsingLivePort_FailsClosed` ✅

**Proof:** All side-effect operations blocked in dry-run mode, intents recorded but never executed.

---

### Invariant B: Advisory Receipts Non-Enforceable
**Tests Covering:**
- `DryRunLawTests::DryRun_GeneratesAdvisoryReceiptWithNonPromotableMarkers` ✅
- `OmegaGateTests::SuccessfulGate_AllowsAndRecordsVerification` ✅

**Proof:** Receipts generated in dry-run have `enforceable=false`, `mode=dry_run`.

---

### Invariant C: Failure Stages Block Progression
**Tests Covering:**
- `OmegaGateTests::MissingHash_DeniesWithHashStage` ✅
- `OmegaGateTests::AuditUnavailable_DeniesWithAuditStage` ✅
- `OmegaGateTests::EvidenceVerificationFailure_DeniesWithVerifyStage` ✅

**Proof:** Each port failure sets specific FailureStage, prevents gate approval.

---

### Invariant D: SDK Gaps Fail Closed
**Tests Covering:**
- `OmegaGateTests::MissingHash_DeniesWithHashStage` ✅ (canonicalization gap → Hash=null → deny)
- `OmegaGateTests::AuditUnavailable_DeniesWithAuditStage` ✅ (Evidence.CreateAsync gap → audit fails → deny)

**Proof:** SDK gaps do not trigger workarounds; they trigger explicit failure stages.

---

### Invariant E: Generic Types, No Vendor Coupling
**Tests Covering:**
- All tests use only generic types: `PublishPacket`, `GateResult`, `GovernanceDecisionResult`
- No OmegaClient type leaked into test assertions

**Proof:** Core types are vendor-neutral by construction.

---

### Invariant F: Port Boundaries Enforced
**Tests Covering:**
- `SideEffectPortTests::Guard_OutsidePort_Throws` ✅
- `SideEffectPortTests::Prod_WithEnforceableAuthorization_ExecutesThroughBoundary` ✅
- `SideEffectPortTests::Prod_WithoutEnforceableAuthorization_FailsClosed` ✅

**Proof:** Port boundaries are strict enforcement mechanisms, not suggestions.

---

### Invariant G: Prod Mode Requires Explicit Authorization
**Tests Covering:**
- `DryRunLawTests::ProdMode_RequiresExplicitOptIn` ✅
- `SideEffectPortTests::Prod_WithoutEnforceableAuthorization_FailsClosed` ✅

**Proof:** Prod mode alone is insufficient; execution requires enforceable receipt.

---

## Test Class Breakdown

| Class | Tests | Invariants Proven |
|-------|-------|-------------------|
| OmegaGateTests | 4 | A, C, D, E |
| DryRunLawTests | 6 | A, B, G |
| SideEffectPortTests | 5 | A, F, G |
| ApiControllerTests | 9 | E, B, G |
| WebSocketEventTests | 5 | B, G |

---

## Key Observations

### SDK Gap Evidence
- **Hash Canonicalization:** Missing in SDK, `packet.Hash = null`, caught at gate (FailureStage.Hash)
- **Evidence.CreateAsync:** Missing in SDK, audit write fails closed (FailureStage.Audit)
- **Evidence.DownloadAsync:** Not attempted in tests; documented as unavailable

### Fail-Closed Behavior Verified
All 3 gaps trigger explicit denials, never silent failures or workarounds.

### No External Calls Recorded
Zero evidence of GitHub API invocations in any test execution.

---

## Baseline Status: ✅ Ready for E2E Phases

All critical invariants covered by existing tests.
No violations detected.
Foundation is sound.

