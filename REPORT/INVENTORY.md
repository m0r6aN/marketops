# 🔍 PHASE -1 INVENTORY REPORT

**Date:** 2026-02-01  
**Repository:** `d:\Repos\marketops`  
**Mission:** SDK-First Refactor (Local Only)

---

## 📦 CURRENT SOLUTION STRUCTURE

### Solution File: `MarketOps.sln`

```
/src/
  - MarketOps.Cli
  - MarketOps.Keon
  - MarketOps

/tests/
  - MarketOps.Cli.Tests
  - MarketOps.Tests
```

---

## 🔗 PROJECT DEPENDENCY GRAPH

### `MarketOps` (Core)
- **Target:** `net10.0`
- **References:** BCL ONLY ✅
- **Status:** CLEAN (No external coupling)

### `MarketOps.Keon` (Adapter - TO BE REPLACED)
- **Target:** `net10.0`
- **References:**
  - `MarketOps` (local)
  - **EXTERNAL KEON DEPENDENCIES:**
    - `..\..\..\..\..\src\Keon.Canonicalization\Keon.Canonicalization.csproj`
    - `..\..\..\..\..\src\Keon.Contracts\Keon.Contracts.csproj`
    - `..\..\..\..\..\src\Keon.Sdk\Keon.Sdk.csproj`
    - `..\..\..\..\..\src\Keon.Verification\Keon.Verification.csproj`
- **Status:** ⚠️ DIRECT KEON COUPLING (VIOLATION)

### `MarketOps.Cli` (Composition Root)
- **Target:** `net10.0`
- **References:**
  - `MarketOps` (local)
  - `MarketOps.Keon` (local)
  - **EXTERNAL:**
    - `..\..\..\src\Keon.Runtime\Keon.Runtime.csproj`
- **Status:** ⚠️ KEON COUPLING (VIOLATION)

### `MarketOps.Tests`
- **Target:** `net10.0`
- **References:**
  - `MarketOps` (local)
  - `MarketOps.Keon` (local)
  - xUnit packages
- **Status:** ⚠️ KEON COUPLING (VIOLATION)

### `MarketOps.Cli.Tests`
- **Target:** `net10.0`
- **References:**
  - `MarketOps.Cli` (local)
  - xUnit packages
- **Status:** ⚠️ INDIRECT KEON COUPLING

---

## 🚨 COUPLING VIOLATIONS DETECTED

### Direct Keon Usage in `MarketOps.Keon`

**Files:**
- `KeonGate.cs` - Uses `Keon.Sdk.KeonClient`, `Keon.Contracts.*`, `Keon.Canonicalization.*`
- `KeonDecisionClient.cs` - Uses `Keon.Sdk.KeonClient`
- `KeonExecutionClient.cs` - Uses `Keon.Sdk.KeonClient`
- `MarketOpsAuditWriter.cs` - Uses `Keon.Canonicalization.*`, `Keon.Verification.*`, `HttpClient`
- `EvidencePackVerifier.cs` - Uses `Keon.Verification.*`

**Interfaces (Ports - GOOD):**
- `IMarketOpsDecisionClient.cs` - References Keon types (needs abstraction)
- `IMarketOpsExecutionClient.cs` - References Keon types (needs abstraction)
- `IMarketOpsAuditWriter.cs` - References Keon types (needs abstraction)
- `IEvidencePackVerifier.cs` - References Keon types (needs abstraction)

### Direct Keon Usage in `MarketOps.Cli`

**File:** `Program.cs`

**Lines with Keon coupling:**
- L12-16: `using global::Keon.*` imports
- L176-179: `KEON_CONTROL_URL` environment variable
- L181-184: Direct `HttpClient` instantiation for Keon Control
- L186-194: Direct instantiation of Keon clients
- L320: `KeonCanonicalJsonV1.Canonicalize`
- L430-447: `RuntimeGatewayAdapter` wrapping `Keon.Runtime.RuntimeGateway`

### HTTP Client Usage (VIOLATION)

**Direct REST calls found:**
- `MarketOps.Keon/MarketOpsAuditWriter.cs`:
  - L84-87: `POST /compliance/evidence-packs`
  - L97-99: `GET /compliance/evidence-packs/{packId}/download`
- `MarketOps.Cli/Program.cs`:
  - L181-184: `HttpClient` for Keon Control URL

---

## 📊 CORE MARKETOPS ANALYSIS (PURE LOGIC)

### ✅ CLEAN FILES (BCL ONLY)

**Contracts:**
- `src/MarketOps/Contracts/PublishPacket.cs`
- `src/MarketOps/Contracts/GateResult.cs`

**Ports (Interfaces):**
- `src/MarketOps/Gate/IMarketOpsGate.cs` ✅
- `src/MarketOps/Curator/IMarketOpsCurator.cs` ✅
- `src/MarketOps/Observer/IMarketOpsObserver.cs` ✅
- `src/MarketOps/Publisher/IMarketOpsPublisher.cs` ✅

**Logic:**
- `src/MarketOps/Gate/MarketOpsGateConfig.cs` ✅
- `src/MarketOps/Delay/DelayController.cs` ✅
- `src/MarketOps/Publisher/IMarketOpsPublisher.cs` (includes `AllowlistPublisherGuard`) ✅

**Status:** Core is ALREADY CLEAN ✅

---

## 🔍 GREP HOTSPOTS

### Keon References
```bash
# Command: rg "Keon" src --type cs
```

**Results:**
- `src/MarketOps.Keon/*` - ALL FILES (expected)
- `src/MarketOps.Cli/Program.cs` - Lines 12-16, 176, 320, 430-447
- `src/MarketOps/Contracts/PublishPacket.cs` - Line 24 (`PublishPacketKeon` record)
- `src/MarketOps/Contracts/GateResult.cs` - Line 36 (`GateKeonEvidence` record)

### Federation References
```bash
# Command: rg "Federation|federation" src --type cs
```

**Results:** NONE ✅

### HttpClient References
```bash
# Command: rg "HttpClient" src --type cs
```

**Results:**
- `src/MarketOps.Keon/MarketOpsAuditWriter.cs` - Lines 15, 22, 24
- `src/MarketOps.Cli/Program.cs` - Line 181

### MCP References
```bash
# Command: rg "mcp|MCP" src --type cs
```

**Results:** NONE ✅

---

## 📁 FILE INVENTORY

### Total Projects: 5
### Total Source Files: ~25
### Total Test Files: ~7

**Breakdown:**
- Core (MarketOps): 11 files
- Adapter (MarketOps.Keon): 10 files
- CLI (MarketOps.Cli): 1 file
- Tests: 7 files

---

## ⚠️ CRITICAL FINDINGS

1. **EXTERNAL KEON DEPENDENCIES** - `MarketOps.Keon` references Keon projects OUTSIDE this repository
2. **NO OMEGA-SDK USAGE** - Zero references to `omega-sdk` found
3. **DIRECT HTTP USAGE** - `HttpClient` used directly in adapter and CLI
4. **KEON TYPES IN CONTRACTS** - `PublishPacketKeon` and `GateKeonEvidence` in core contracts
5. **ENVIRONMENT VARIABLES** - `KEON_CONTROL_URL`, `KEON_SIGNING_PUBLIC_KEY_B64` hardcoded

---

## ✅ POSITIVE FINDINGS

1. **CORE IS CLEAN** - `MarketOps` project has ZERO external dependencies
2. **PORT INTERFACES EXIST** - Abstraction layer already partially in place
3. **DETERMINISTIC LOGIC** - Validation, hashing, config logic is pure
4. **TEST COVERAGE** - Existing tests for core behavior

---

## 🎯 REFACTOR SCOPE

### HIGH PRIORITY
1. Replace `MarketOps.Keon` with `MarketOps.OmegaSdk`
2. Remove all Keon imports from `MarketOps.Cli`
3. Abstract Keon-specific types from core contracts
4. Eliminate `HttpClient` usage outside SDK

### MEDIUM PRIORITY
1. Update tests to use fake implementations
2. Remove Keon environment variables
3. Update documentation

### LOW PRIORITY
1. Clean up `bin/` and `obj/` directories
2. Harden `.gitignore`

---

**END OF INVENTORY**

