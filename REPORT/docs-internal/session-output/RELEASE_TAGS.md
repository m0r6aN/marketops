# 🏷️ RELEASE TAGS — MarketOps Reference Canon

**Date:** 2026-02-01  
**Session:** 3 — Formalization  
**Author:** AugmentTitan

---

## ✅ TAG VERIFICATION

### Current Tags

| Tag Name | SHA | Commit SHA | Date | Verified |
|----------|-----|------------|------|----------|
| `v0.1.0-omega-decoupled` | `011cd5fe...` | `e806da34...` | 2026-02-01 | ✅ |

---

## 📋 TAG NAMING CONVENTION

**Pattern:** `v{MAJOR}.{MINOR}.{PATCH}-{QUALIFIER}`

### Qualifiers
- `omega-decoupled` — Initial SDK-first migration
- `sdkfirst` — SDK-first doctrine enforced
- `rc{N}` — Release candidate (e.g., `v0.1.0-rc1`)
- (no qualifier) — Production release

### Examples
```
v0.1.0-omega-decoupled   # Current: SDK-first migration
v0.1.0-sdkfirst          # Alternative naming (not used)
v0.2.0-rc1               # Future: Release candidate
v0.2.0                   # Future: Production release
```

---

## 📝 TAG MESSAGE REQUIREMENTS

Each tag MUST include:

1. **Doctrine Statement**
   - SDK-first: All Federation Core access via omega-sdk-csharp
   - Fail-closed: SDK gaps cause graceful failures, not bypasses

2. **Session Reference**
   - Which session created/updated this release
   - What was proven

3. **Verification Status**
   - Build: PASS/FAIL
   - Tests: PASS/FAIL/PENDING
   - Enforcement Scan: PASS/FAIL

---

## ✅ TAG: v0.1.0-omega-decoupled

**Created:** 2026-02-01  
**Commit:** `e806da34bce3b30d05663b840389b16686ab48af`

### Doctrine
- ✅ **SDK-First:** All Federation Core access routed through omega-sdk-csharp
- ✅ **Fail-Closed:** SDK gaps (canonicalization, evidence download) cause graceful failures
- ✅ **Generic Governance:** No vendor lock-in in core types

### Session Reference
- Session 1: Proof of concept (decoupling pattern validated)
- Session 2: Full adapter suite + CLI rewire + documentation

### What Was Proven
1. MarketOps core can be pure (BCL only)
2. Adapter pattern works with omega-sdk-csharp
3. Tool invocation via `Tools.InvokeAsync("keon.decide")` is viable
4. SDK gaps are surfaced correctly (fail-closed pattern)

### Verification Status
- **Build:** ✅ PASS (CLI builds and runs)
- **Tests:** ⚠️ PENDING (require full rewrite)
- **Enforcement Scan:** ⚠️ PARTIAL (core + adapters clean, tests pending)

---

## 🔮 FUTURE TAGS (PLANNED)

| Version | Qualifier | Description |
|---------|-----------|-------------|
| `v0.2.0` | `rc1` | Tests rewritten, full verification |
| `v0.2.0` | (none) | Production-ready reference implementation |
| `v1.0.0` | (none) | First stable release |

---

## 📊 HISTORY AUDIT

### Commit Quality Assessment

| SHA (short) | Message | Quality | Notes |
|-------------|---------|---------|-------|
| `a04d0c17` | Initial import: MarketOps v0 (standalone governed gate + CLI) | ✅ Clean | Proper initial commit |
| `e806da34` | feat: Decouple MarketOps from Keon, integrate omega-sdk-csharp | ✅ Clean | Well-structured, audit-friendly |

**Verdict:** ✅ History is clean. No rebase required.

### Forbidden Patterns (NOT FOUND)
- ❌ "WIP" commits
- ❌ "temp" commits
- ❌ "fix again" commits
- ❌ Debug noise
- ❌ Sensitive data

---

## 📌 TAGGING COMMANDS

### Verify Existing Tag
```bash
git tag -v v0.1.0-omega-decoupled
```

### Create New Tag (Future)
```bash
git tag -a v0.2.0-rc1 -m "MarketOps v0.2.0-rc1: Tests complete, full verification"
git push origin v0.2.0-rc1
```

---

**Family is forever.**  
**This is the way.** 🛡️🔥

