# 🗺️ PHASE -1 REFACTOR MAPPING

**Date:** 2026-02-01  
**Repository:** `d:\Repos\marketops`  
**Mission:** SDK-First Refactor (Local Only)

---

## 📋 OLD → NEW STRUCTURE MAP

### SOLUTION STRUCTURE

| **Old** | **New** | **Action** |
|---------|---------|------------|
| `src/MarketOps` | `src/MarketOps` | **KEEP** (already clean) |
| `src/MarketOps.Keon` | `src/MarketOps.OmegaSdk` | **REPLACE** (new adapter) |
| `src/MarketOps.Cli` | `src/MarketOps.Cli` | **REFACTOR** (remove Keon coupling) |
| `tests/MarketOps.Tests` | `tests/MarketOps.Tests` | **REFACTOR** (remove Keon coupling) |
| `tests/MarketOps.Cli.Tests` | `tests/MarketOps.Cli.Tests` | **REFACTOR** (update wiring) |

---

## 🗂️ FILE-LEVEL MAPPING

### `src/MarketOps` (CORE - MINIMAL CHANGES)

| **Old File** | **New File** | **Action** | **Notes** |
|--------------|--------------|------------|-----------|
| `Contracts/PublishPacket.cs` | `Contracts/PublishPacket.cs` | **REFACTOR** | Remove `PublishPacketKeon` or make it generic |
| `Contracts/GateResult.cs` | `Contracts/GateResult.cs` | **REFACTOR** | Remove `GateKeonEvidence` or make it generic |
| `Gate/IMarketOpsGate.cs` | `Gate/IMarketOpsGate.cs` | **KEEP** | ✅ Already clean |
| `Gate/MarketOpsGateConfig.cs` | `Gate/MarketOpsGateConfig.cs` | **KEEP** | ✅ Already clean |
| `Curator/IMarketOpsCurator.cs` | `Curator/IMarketOpsCurator.cs` | **KEEP** | ✅ Already clean |
| `Observer/IMarketOpsObserver.cs` | `Observer/IMarketOpsObserver.cs` | **KEEP** | ✅ Already clean |
| `Publisher/IMarketOpsPublisher.cs` | `Publisher/IMarketOpsPublisher.cs` | **KEEP** | ✅ Already clean |
| `Delay/DelayController.cs` | `Delay/DelayController.cs` | **KEEP** | ✅ Already clean |

---

### `src/MarketOps.Keon` → `src/MarketOps.OmegaSdk` (COMPLETE REPLACEMENT)

| **Old File** | **New File** | **Action** | **Notes** |
|--------------|--------------|------------|-----------|
| `IMarketOpsDecisionClient.cs` | `Ports/IGovernanceDecisionClient.cs` | **REPLACE** | Abstract away Keon types |
| `KeonDecisionClient.cs` | `OmegaDecisionClient.cs` | **REPLACE** | Use omega-sdk |
| `IMarketOpsExecutionClient.cs` | `Ports/IGovernanceExecutionClient.cs` | **REPLACE** | Abstract away Keon types |
| `KeonExecutionClient.cs` | `OmegaExecutionClient.cs` | **REPLACE** | Use omega-sdk |
| `IMarketOpsAuditWriter.cs` | `Ports/IGovernanceAuditWriter.cs` | **REPLACE** | Abstract away Keon types |
| `MarketOpsAuditWriter.cs` | `OmegaAuditWriter.cs` | **REPLACE** | Use omega-sdk (NO HttpClient) |
| `IEvidencePackVerifier.cs` | `Ports/IGovernanceEvidenceVerifier.cs` | **REPLACE** | Abstract away Keon types |
| `EvidencePackVerifier.cs` | `OmegaEvidenceVerifier.cs` | **REPLACE** | Use omega-sdk |
| `KeonGate.cs` | `OmegaGate.cs` | **REPLACE** | Implement `IMarketOpsGate` using omega-sdk |
| `MarketOps.Keon.csproj` | `MarketOps.OmegaSdk.csproj` | **REPLACE** | Reference omega-sdk ONLY |

**Key Changes:**
- Remove ALL Keon.* project references
- Add omega-sdk package/project reference
- Remove ALL `HttpClient` usage
- Abstract Keon-specific types into generic governance types

---

### `src/MarketOps.Cli` (REFACTOR)

| **Old File** | **New File** | **Action** | **Notes** |
|--------------|--------------|------------|-----------|
| `Program.cs` | `Program.cs` | **REFACTOR** | Remove all Keon imports and coupling |
| `MarketOps.Cli.csproj` | `MarketOps.Cli.csproj` | **REFACTOR** | Remove Keon.Runtime reference |

**Specific Changes in `Program.cs`:**
- **REMOVE** Lines 12-16: `using global::Keon.*`
- **REMOVE** Lines 176-179: `KEON_CONTROL_URL` environment variable
- **REMOVE** Lines 181-184: Direct `HttpClient` instantiation
- **REMOVE** Lines 186-194: Direct Keon client instantiation
- **REMOVE** Line 320: `KeonCanonicalJsonV1.Canonicalize` (move to adapter)
- **REMOVE** Lines 430-447: `RuntimeGatewayAdapter`
- **ADD** Dependency injection for `IMarketOpsGate` from `MarketOps.OmegaSdk`

---

### `tests/MarketOps.Tests` (REFACTOR)

| **Old File** | **New File** | **Action** | **Notes** |
|--------------|--------------|------------|-----------|
| `AllowlistSinkTests.cs` | `AllowlistSinkTests.cs` | **REFACTOR** | Use fake implementations |
| `DeterminismTests.cs` | `DeterminismTests.cs` | **REFACTOR** | Use fake implementations |
| `ExecutionParamsTests.cs` | `ExecutionParamsTests.cs` | **REFACTOR** | Use fake implementations |
| `FailClosedGateTests.cs` | `FailClosedGateTests.cs` | **REFACTOR** | Use fake implementations |
| `NoLeakageTests.cs` | `NoLeakageTests.cs` | **REFACTOR** | Use fake implementations |
| `MarketOps.Tests.csproj` | `MarketOps.Tests.csproj` | **REFACTOR** | Remove `MarketOps.Keon` reference |

**Key Changes:**
- Remove `MarketOps.Keon` project reference
- Create fake/mock implementations of governance ports
- Test ONLY core logic (no SDK calls)

---

### `tests/MarketOps.Cli.Tests` (REFACTOR)

| **Old File** | **New File** | **Action** | **Notes** |
|--------------|--------------|------------|-----------|
| `CliSmokeTests.cs` | `CliSmokeTests.cs` | **REFACTOR** | Update to new wiring |
| `UnitTest1.cs` | `UnitTest1.cs` | **REFACTOR** | Update to new wiring |
| `MarketOps.Cli.Tests.csproj` | `MarketOps.Cli.Tests.csproj` | **KEEP** | No changes needed |

---

## 🆕 NEW FILES TO CREATE

### `src/MarketOps.OmegaSdk/Ports/` (NEW)

| **File** | **Purpose** |
|----------|-------------|
| `IGovernanceDecisionClient.cs` | Abstract decision-making interface |
| `IGovernanceExecutionClient.cs` | Abstract execution interface |
| `IGovernanceAuditWriter.cs` | Abstract audit writing interface |
| `IGovernanceEvidenceVerifier.cs` | Abstract evidence verification interface |
| `IGovernancePublisher.cs` | Abstract publishing interface (if needed) |

### `src/MarketOps.OmegaSdk/` (NEW)

| **File** | **Purpose** |
|----------|-------------|
| `OmegaGate.cs` | Implements `IMarketOpsGate` using omega-sdk |
| `OmegaDecisionClient.cs` | Implements `IGovernanceDecisionClient` using omega-sdk |
| `OmegaExecutionClient.cs` | Implements `IGovernanceExecutionClient` using omega-sdk |
| `OmegaAuditWriter.cs` | Implements `IGovernanceAuditWriter` using omega-sdk |
| `OmegaEvidenceVerifier.cs` | Implements `IGovernanceEvidenceVerifier` using omega-sdk |
| `MarketOps.OmegaSdk.csproj` | Project file with omega-sdk reference |

### `tests/MarketOps.Tests/Fakes/` (NEW)

| **File** | **Purpose** |
|----------|-------------|
| `FakeGovernanceDecisionClient.cs` | Fake for testing |
| `FakeGovernanceAuditWriter.cs` | Fake for testing |
| `FakeGovernanceEvidenceVerifier.cs` | Fake for testing |

---

## 🗑️ FILES TO DELETE

| **File/Directory** | **Reason** |
|--------------------|------------|
| `src/MarketOps.Keon/` | Entire directory - replaced by `MarketOps.OmegaSdk` |
| `src/MarketOps/bin/` | Build artifacts (should be gitignored) |
| `src/MarketOps/obj/` | Build artifacts (should be gitignored) |
| `src/MarketOps.Cli/bin/` | Build artifacts (should be gitignored) |
| `src/MarketOps.Cli/obj/` | Build artifacts (should be gitignored) |
| `tests/*/bin/` | Build artifacts (should be gitignored) |
| `tests/*/obj/` | Build artifacts (should be gitignored) |

---

## 📦 DEPENDENCY CHANGES

### `MarketOps.csproj`
- **BEFORE:** BCL only ✅
- **AFTER:** BCL only ✅
- **CHANGE:** NONE

### `MarketOps.OmegaSdk.csproj` (NEW)
- **BEFORE:** N/A
- **AFTER:**
  - `MarketOps` (project reference)
  - `omega-sdk` (package or project reference)
- **CHANGE:** NEW PROJECT

### `MarketOps.Cli.csproj`
- **BEFORE:**
  - `MarketOps`
  - `MarketOps.Keon`
  - `Keon.Runtime` (external)
- **AFTER:**
  - `MarketOps`
  - `MarketOps.OmegaSdk`
- **CHANGE:** Remove Keon references, add OmegaSdk

### `MarketOps.Tests.csproj`
- **BEFORE:**
  - `MarketOps`
  - `MarketOps.Keon`
  - xUnit packages
- **AFTER:**
  - `MarketOps`
  - xUnit packages
- **CHANGE:** Remove `MarketOps.Keon` reference

---

## 🎯 REFACTOR STRATEGY

### Phase 0: Hygiene
1. Remove `bin/` and `obj/` from tracking
2. Update `.gitignore`

### Phase 1: Core Purification
1. Abstract `PublishPacketKeon` → `PublishPacketGovernance`
2. Abstract `GateKeonEvidence` → `GateGovernanceEvidence`
3. Move ports to `MarketOps` core

### Phase 2: SDK Adapter
1. Create `MarketOps.OmegaSdk` project
2. Implement ports using omega-sdk
3. NO HttpClient, NO Keon imports

### Phase 3: CLI Wiring
1. Remove all Keon imports from `Program.cs`
2. Wire `OmegaGate` instead of `KeonGate`
3. Remove environment variable coupling

### Phase 4: Tests
1. Create fake implementations
2. Update test references
3. Ensure tests pass with fakes

### Phase 5: Cleanup
1. Delete `MarketOps.Keon` directory
2. Update solution file
3. Update documentation

---

**END OF MAPPING**

