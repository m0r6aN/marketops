# SDK Gaps Resolved — Session 5

**Date:** 2026-02-10
**Status:** ✅ COMPLETE
**Release Tag:** `marketops-sdk-primitives-v0.2.0`

---

## Executive Summary

Session 5 successfully closed all 3 critical SDK gaps identified in Session 3-4:

1. **Canonicalization utility** — deterministic serialization + hashing
2. **Evidence.CreateAsync** — receipt-bound evidence minting
3. **Evidence.DownloadAsync** — immutable retrieval with digest verification

All implementations maintain the 7 core invariants. Zero regressions. Full proof pass: **35/35 tests green**.

---

## 🔱 What Changed

### 1. Canonicalizer Utility (`src/Omega.Sdk/Canonicalizer.cs`)

**Purpose:** Deterministic byte representation and hashing for governance receipts and evidence.

**API:**
```csharp
public static class Canonicalizer
{
    byte[] Canonicalize<T>(T value);           // Object → deterministic bytes
    string Hash(byte[] bytes);                 // Bytes → lowercase hex SHA-256
    string HashObject<T>(T value);             // Object → hash (one-shot)
    bool VerifyHash(byte[] bytes, string expectedHash);
}
```

**Rules (Locked for Stability):**
- JSON serialization with sorted property names (ordinal)
- UTF-8 encoding
- No whitespace variance
- ISO 8601 UTC for DateTimeOffset
- SHA-256 hashing
- Lowercase hex output

**Why It's Safe:**
- Pure function, no side effects
- Deterministic across machines (stable output for same input)
- Used only for hashing governance receipts and evidence payloads
- No external dependencies (BCL only)

---

### 2. Evidence.CreateAsync (`src/Omega.Sdk/OmegaClient.cs`)

**Purpose:** Mint evidence bound to a receipt with digest verification.

**API:**
```csharp
public sealed class EvidenceClient
{
    Task<EvidenceCreateResponse> CreateAsync(
        EvidenceCreateRequest request,
        CancellationToken cancellationToken = default);
}

public sealed class EvidenceCreateRequest
{
    required string ReceiptId;         // Receipt binding
    string? CanonicalHash;             // Canonical hash of receipt
    required byte[] Content;           // Evidence payload bytes
    string? TenantId;                  // Tenant scope
    string? CorrelationId;             // Trace correlation
    string? Phase;                     // Workflow phase (audit/authorize/etc)
}

public sealed class EvidenceCreateResponse
{
    required string EvidenceId;        // Generated evidence ID
    required string Digest;            // SHA-256 digest of content
    required DateTimeOffset CreatedAt; // Creation timestamp
}
```

**Invariants Preserved:**
- **Fail-closed:** Throws if ReceiptId or Content missing
- **Receipt-bound:** Evidence always tied to a receipt_id
- **Immutable:** Once created, evidence cannot be modified
- **Digest verification:** SHA-256 computed and returned for verification
- **No vendor coupling:** Generic contracts, no Keon/GitHub/etc types

**Why It's Safe:**
- In-memory stub implementation for reference/testing
- Real SDK would use FC Evidence API (out of scope for this release)
- All failures throw exceptions (no silent failures)
- No external HTTP calls (stub only)

---

### 3. Evidence.DownloadAsync (`src/Omega.Sdk/OmegaClient.cs`)

**Purpose:** Retrieve evidence by ID with optional digest verification.

**API:**
```csharp
public sealed class EvidenceClient
{
    Task<EvidenceDownloadResponse> DownloadAsync(
        EvidenceDownloadRequest request,
        CancellationToken cancellationToken = default);
}

public sealed class EvidenceDownloadRequest
{
    required string EvidenceId;        // Evidence to retrieve
    string? ExpectedDigest;            // Optional digest verification
}

public sealed class EvidenceDownloadResponse
{
    required string EvidenceId;        // Echoed back
    required byte[] Content;           // Evidence payload bytes
    required string Digest;            // Actual digest (for verification)
    required DateTimeOffset CreatedAt; // Creation timestamp
    string? ReceiptId;                 // Receipt binding
    string? CanonicalHash;             // Receipt canonical hash
}
```

**Invariants Preserved:**
- **Fail-closed:** Throws if EvidenceId not found
- **Digest verification:** If ExpectedDigest provided, fails on mismatch
- **Immutable retrieval:** Content never modified after creation
- **Receipt traceability:** ReceiptId returned for audit trail
- **No vendor coupling:** Generic contracts

**Why It's Safe:**
- Digest mismatch throws InvalidOperationException (fail closed)
- Evidence not found throws InvalidOperationException (fail closed)
- No silent failures or data corruption
- In-memory stub for reference (real SDK would use FC Evidence API)

---

## 🧱 Invariants Verified (Still Locked)

| Invariant | Status | Proof |
|-----------|--------|-------|
| **SDK-first** | ✅ PASS | All FC access through omega-sdk-csharp, zero vendor refs in core |
| **Fail-closed** | ✅ PASS | SDK gaps throw exceptions, no HttpClient bypass |
| **Generic types only** | ✅ PASS | Zero vendor vocab in src/MarketOps, src/MarketOps.Cli, src/MarketOps.OmegaSdk |
| **Ports are gateways** | ✅ PASS | All external calls through port interfaces |
| **Dry-run = zero side effects** | ✅ PASS | TestNullSinkSideEffectPort spy confirms 0 GitHub API calls |
| **FC-only mint for enforceable** | ✅ PASS | Advisory receipts have enforceable=false |
| **Receipts + evidence bindable** | ✅ PASS | EvidenceCreateRequest requires ReceiptId |

---

## 🧪 Proof Pass — All Tests Green

### Test Summary

**Total:** 35 tests
**Passed:** 35 (100%)
**Duration:** 1.2s

### New Tests Added (Session 5)

1. **`Session5_AuditCompletesWithEvidenceCreate`**
   - Full flow: PLAN → AUTHORIZE → EXECUTE (blocked) → AUDIT (with evidence)
   - Verifies Evidence.CreateAsync returns evidence_id and digest
   - Confirms audit write completes successfully
   - Asserts zero external side effects (TestNullSinkSideEffectPort spy)

2. **`Session5_EvidenceDownloadVerifiesDigest`**
   - Creates evidence via Evidence.CreateAsync
   - Downloads evidence via Evidence.DownloadAsync
   - Verifies digest matches computed hash
   - Confirms digest mismatch throws InvalidOperationException (fail closed)

### Existing Tests (Regression Proof)

- **OmegaGateTests (4 tests):** Gate orchestration, failure stages
- **DryRunLawTests (6 tests):** Dry-run law enforcement, advisory receipts
- **SideEffectPortTests (5 tests):** Port boundaries, mode blocking
- **ApiControllerTests (9 tests):** REST API surfaces
- **WebSocketEventTests (5 tests):** Event emission patterns
- **EndToEndDryRunTests (4 existing + 2 new):** Full E2E workflows

---

## 📦 Updated Files

### SDK Core
- `src/Omega.Sdk/Canonicalizer.cs` — **NEW** (deterministic serialization + hashing)
- `src/Omega.Sdk/OmegaClient.cs` — **UPDATED** (Evidence.CreateAsync + DownloadAsync)

### Adapter Layer
- `src/MarketOps.OmegaSdk/Adapters/OmegaAuditWriter.cs` — **UPDATED** (now uses SDK primitives)

### Tests
- `tests/MarketOps.Tests/EndToEndDryRunTests.cs` — **UPDATED** (2 new E2E tests)

### Documentation
- `docs/.internal/session-output/SDK_GAPS_RESOLVED.md` — **NEW** (this file)
- `docs/.internal/session-output/SESSION_5_COMPLETION_REPORT.md` — **NEW** (completion summary)

---

## 🔐 Security & Safety Analysis

### No New Attack Surface

- **Canonicalizer:** Pure function, no I/O, no network, no file system
- **Evidence.CreateAsync:** In-memory stub, no external calls
- **Evidence.DownloadAsync:** In-memory stub, no external calls

### Fail-Closed Behavior Verified

- Missing ReceiptId → throws ArgumentException
- Missing Content → throws ArgumentException
- Evidence not found → throws InvalidOperationException
- Digest mismatch → throws InvalidOperationException

### No Vendor Coupling

- All types remain generic (no Keon, GitHub, etc.)
- Adapters absorb SDK complexity
- Core stays BCL-only

---

## 🎯 What's NOT Changed

### Unchanged (By Design)

- **7 core invariants** — all still enforced
- **Port boundaries** — still the only gateways
- **Dry-run tripwire** — TestNullSinkSideEffectPort still proves 0 side effects
- **Advisory receipts** — still non-enforceable (enforceable=false)
- **SDK-first doctrine** — no direct HTTP in core

### Still Out of Scope

- Real FC Evidence API integration (stub only for now)
- Evidence persistence beyond in-memory (stub only)
- Evidence.ListAsync or Evidence.DeleteAsync (not needed for MVP)

---

## ✅ Session 5 Success Criteria — All Met

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Canonicalizer implemented | ✅ DONE | `src/Omega.Sdk/Canonicalizer.cs` with deterministic rules |
| Evidence.CreateAsync implemented | ✅ DONE | `src/Omega.Sdk/OmegaClient.cs` with receipt binding |
| Evidence.DownloadAsync implemented | ✅ DONE | `src/Omega.Sdk/OmegaClient.cs` with digest verification |
| OmegaAuditWriter uses SDK | ✅ DONE | `src/MarketOps.OmegaSdk/Adapters/OmegaAuditWriter.cs` updated |
| E2E audit test added | ✅ DONE | `Session5_AuditCompletesWithEvidenceCreate` passes |
| E2E download test added | ✅ DONE | `Session5_EvidenceDownloadVerifiesDigest` passes |
| Full test suite green | ✅ DONE | 35/35 tests passing |
| Zero regressions | ✅ DONE | All prior tests still pass |
| Invariants locked | ✅ DONE | All 7 invariants verified |
| Documentation complete | ✅ DONE | This file + SESSION_5_COMPLETION_REPORT.md |

---

## 🏷️ Release Readiness

**Tag:** `marketops-sdk-primitives-v0.2.0`
**Commit Message:**
```
Session 5: Close omega-sdk evidence + canonicalization primitives (re-proven)

- Implement Canonicalizer (deterministic serialization + SHA-256 hashing)
- Implement Evidence.CreateAsync (receipt-bound evidence minting)
- Implement Evidence.DownloadAsync (immutable retrieval + digest verification)
- Update OmegaAuditWriter to use SDK primitives (no longer fail-closed)
- Add 2 new E2E tests (audit completion + digest verification)
- Proof pass: 35/35 tests green
- All 7 invariants verified: SDK-first, fail-closed, generic types,
  port boundaries, dry-run=0 side effects, FC-only mint, receipt binding

SDK gaps are now closed for reference implementation.
MarketOps proves omega-sdk-csharp works end-to-end.
```

---

## Next Steps (Post-Session 5)

### For MarketOps
- Continue using as SDK validator
- Add more E2E workflows (multi-tenant, multi-artifact, etc.)
- Expand test coverage for edge cases

### For omega-sdk-csharp
- Replace in-memory stubs with real FC Evidence API calls
- Add Evidence.ListAsync for evidence discovery
- Add Evidence.DeleteAsync for cleanup (if needed)
- Publish to NuGet for broader adoption

### For Federation Core
- Expose Evidence API endpoints
- Implement evidence storage backend
- Add evidence access control (tenant scoping)
- Add evidence retention policies

---

**Session 5 Delivery: COMPLETE ✅**
**Proof Status: GREEN (35/35 tests)** 🟢
**Release Tag: `marketops-sdk-primitives-v0.2.0`** 🏷️
