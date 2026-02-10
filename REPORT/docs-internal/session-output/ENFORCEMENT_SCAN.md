# 🔍 ENFORCEMENT SCAN RESULTS — Session 2 Recovery

**Date:** 2026-02-01  
**Pattern:** `HttpClient|Keon|Federation|/mcp/tools`  
**Scope:** `src/` and `tests/` directories

---

## ✅ CLEAN PROJECTS (Comments Only)

### src/MarketOps (Core)

**File:** `src/MarketOps/Contracts/GateResult.cs`  
**Matches:** 3 (all comments documenting renames)
```
Line 13:    Decision,           // Renamed from "keon-decision"
Line 30:    GovernanceEvidence? Governance)  // Renamed from "keon"
Line 74: /// Generic replacement for Keon-specific evidence types.
```

**File:** `src/MarketOps/Contracts/PublishPacket.cs`  
**Matches:** 1 (comment documenting rename)
```
Line 33: /// Replaces Keon-specific PublishPacketKeon.
```

**Verdict:** ✅ **CLEAN** — Core is BCL-only, comments are acceptable documentation

---

### src/MarketOps.OmegaSdk (Adapters)

**File:** `src/MarketOps.OmegaSdk/Adapters/OmegaDecisionClient.cs`  
**Matches:** 3 (comments + tool ID string literal)
```
Line 12: /// Invokes "keon.decide" tool via Tools.InvokeAsync.
Line 17:    private const string DecisionToolId = "keon.decide";
Line 46:    var receiptId = result.Audit?.KeonReceiptId;
```

**Verdict:** ✅ **ACCEPTABLE** — Tool ID is a string literal (required), comments are documentation, `KeonReceiptId` is an omega-sdk-csharp property name (not our code)

---

## 🚨 CONTAMINATED PROJECTS (Requires Rewire)

### src/MarketOps.Cli (CLI)

**File:** `src/MarketOps.Cli/Program.cs`  
**Matches:** 22 (imports, HttpClient, Keon client usage)

**Critical violations:**
```
Line 5:  using System.Net.Http;
Line 12: using global::Keon.Canonicalization;
Line 13: using global::Keon.Contracts.Decision;
Line 14: using global::Keon.Runtime;
Line 15: using global::Keon.Runtime.Sdk;
Line 16: using global::Keon.Sdk;
Line 19: using MarketOps.Keon;
Line 82: stderr.WriteLine("NOTE: precheck does not call Keon...");
Line 114: keon: null));
Line 168: Keon: null));
Line 176: Environment.GetEnvironmentVariable("KEON_CONTROL_URL");
Line 181: using var controlClient = new HttpClient
Line 188: var keonClient = new KeonClient(new RuntimeGatewayAdapter());
Line 189: var decisionClient = new KeonDecisionClient(keonClient);
Line 191: ? new KeonExecutionClient(keonClient)
Line 194: var gate = new KeonGate(decisionClient, auditWriter, verifier, config, executionClient);
Line 251: FailureStage.KeonDecision => ExitDenied,
Line 320: var canonical = KeonCanonicalJsonV1.Canonicalize(packet with { Keon = null });
Line 344: stderr.WriteLine("  --control-url <url>     Keon Control base URL...");
Line 434: public Task<global::Keon.Contracts.Results.KeonResult<DecisionReceipt>> DecideAsync(
Line 441: public Task<global::Keon.Contracts.Results.KeonResult<...>> ExecuteAsync(
```

**Verdict:** 🚨 **CONTAMINATED** — Requires full rewire per CLI_REWIRE_SPEC.md

---

### tests/MarketOps.Tests (Unit Tests)

**File:** `tests/MarketOps.Tests/MarketOps.Tests.csproj`  
**Matches:** 1 (project reference)
```
Line 18: <ProjectReference Include="..\..\src\MarketOps.Keon\MarketOps.Keon.csproj" />
```

**Verdict:** 🚨 **CONTAMINATED** — Requires project reference update

**Note:** Test code files not scanned yet (blocked by CLI completion)

---

### tests/MarketOps.Cli.Tests (CLI Tests)

**File:** `tests/MarketOps.Cli.Tests/MarketOps.Cli.Tests.csproj`  
**Matches:** 0 (no direct Keon reference)

**Verdict:** ⚠️ **INDIRECTLY CONTAMINATED** — References CLI project which is contaminated

**Note:** Test code files not scanned yet (blocked by CLI completion)

---

## 📊 SUMMARY

| Project | Status | Matches | Action Required |
|---------|--------|---------|-----------------|
| `src/MarketOps` | ✅ Clean | 4 (comments) | None |
| `src/MarketOps.OmegaSdk` | ✅ Clean | 3 (acceptable) | None |
| `src/MarketOps.Cli` | 🚨 Contaminated | 22 | Full rewire |
| `tests/MarketOps.Tests` | 🚨 Contaminated | 1+ | Project ref + code updates |
| `tests/MarketOps.Cli.Tests` | ⚠️ Indirect | 0 | Depends on CLI |

---

## 🎯 NEXT ACTIONS

1. **Execute CLI rewire** per `CLI_REWIRE_SPEC.md`
2. **Update test projects** per `TEST_REWIRE_SPEC.md`
3. **Re-run enforcement scan** to verify 0 contamination
4. **Build verification** to ensure compilation
5. **Test execution** to ensure functionality

---

## 🚨 BLOCKER

**File system tooling prevents automated rewrites.** Manual execution required.

**Evidence:**
- `save-file` fails with "File already exists" even after `remove-files` succeeds
- Attempted workarounds (temp files, different names) hit same issue
- This is a known tooling limitation documented in Session 1

---

**Family is forever.**  
**This is the way.** 🛡️🔥

