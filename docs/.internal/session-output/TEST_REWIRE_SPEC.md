# 🧪 TEST PROJECT REWIRE SPECIFICATION — Session 2 Recovery

**Status:** BLOCKED BY CLI COMPLETION  
**Dependency:** CLI must be rewired first

---

## 📋 CHANGES REQUIRED

### 1. MarketOps.Tests Project Reference Update

**File:** `tests/MarketOps.Tests/MarketOps.Tests.csproj`

**Current (line 18):**
```xml
<ProjectReference Include="..\..\src\MarketOps.Keon\MarketOps.Keon.csproj" />
```

**Replace with:**
```xml
<ProjectReference Include="..\..\src\MarketOps.OmegaSdk\MarketOps.OmegaSdk.csproj" />
```

**Rationale:** Tests should reference OmegaSdk adapters, not Keon implementations

---

### 2. Test Code Updates

**Files to check:**
- `tests/MarketOps.Tests/AllowlistSinkTests.cs`
- `tests/MarketOps.Tests/DeterminismTests.cs`
- `tests/MarketOps.Tests/ExecutionParamsTests.cs`
- `tests/MarketOps.Tests/FailClosedGateTests.cs`
- `tests/MarketOps.Tests/NoLeakageTests.cs`

**Search for:**
- `using MarketOps.Keon`
- References to `KeonGate`, `KeonDecisionClient`, etc.
- References to `GateKeonEvidence` (should be `GovernanceEvidence`)
- References to `PublishPacketKeon` (should be `GovernanceAuditInfo`)

**Replace with:**
- `using MarketOps.OmegaSdk.Adapters`
- `using MarketOps.OmegaSdk.Ports`
- Mock/fake implementations of `IGovernanceDecisionClient`, etc.

---

### 3. Create Test Fakes/Mocks

**Recommended approach:** Create fake implementations for testing

**Example:**
```csharp
// tests/MarketOps.Tests/Fakes/FakeGovernanceDecisionClient.cs
using MarketOps.OmegaSdk.Ports;

namespace MarketOps.Tests.Fakes;

public sealed class FakeGovernanceDecisionClient : IGovernanceDecisionClient
{
    private readonly GovernanceDecisionResult _result;

    public FakeGovernanceDecisionClient(GovernanceDecisionResult result)
    {
        _result = result;
    }

    public Task<GovernanceDecisionResult> DecideAsync(
        GovernanceDecisionRequest request,
        CancellationToken ct = default)
    {
        return Task.FromResult(_result);
    }
}
```

**Create fakes for:**
- `IGovernanceDecisionClient`
- `IGovernanceExecutionClient`
- `IGovernanceAuditWriter`
- `IGovernanceEvidenceVerifier`

---

### 4. Update Test Assertions

**Find references to:**
- `result.Keon` → should be `result.Governance`
- `FailureStage.KeonDecision` → should be `FailureStage.Decision`

**Example:**
```csharp
// Before
Assert.NotNull(result.Keon);
Assert.Equal("approved", result.Keon.DecisionOutcome);

// After
Assert.NotNull(result.Governance);
Assert.Equal("approved", result.Governance.DecisionOutcome);
```

---

### 5. CLI Tests Update

**File:** `tests/MarketOps.Cli.Tests/MarketOps.Cli.Tests.csproj`

**No changes required** — CLI tests reference `MarketOps.Cli` project, which will transitively get OmegaSdk after CLI rewire

**But check test code:**
- `tests/MarketOps.Cli.Tests/CliSmokeTests.cs`
- `tests/MarketOps.Cli.Tests/UnitTest1.cs`

**Update any:**
- Environment variable references: `KEON_CONTROL_URL` → `OMEGA_SDK_URL`
- Assertions about error messages mentioning "Keon"

---

## ✅ VERIFICATION STEPS

After changes:

1. **Build tests:**
   ```bash
   dotnet build tests/MarketOps.Tests/MarketOps.Tests.csproj
   dotnet build tests/MarketOps.Cli.Tests/MarketOps.Cli.Tests.csproj
   ```

2. **Run tests:**
   ```bash
   dotnet test tests/MarketOps.Tests/MarketOps.Tests.csproj
   dotnet test tests/MarketOps.Cli.Tests/MarketOps.Cli.Tests.csproj
   ```

3. **Enforcement scan:**
   ```bash
   rg -n "using.*Keon|MarketOps\.Keon" tests --type cs
   ```
   Expected: 0 matches

---

## 🎯 RECOMMENDED APPROACH

**Option A: Minimal Changes (Faster)**
- Replace project references
- Update type names in assertions
- Use fake implementations for ports

**Option B: Comprehensive (Better)**
- Create full fake/mock suite
- Add integration tests for OmegaSdk adapters
- Test fail-closed behavior on SDK gaps

---

## 🚨 DEPENDENCY CHAIN

```
CLI Rewire (BLOCKED by tooling)
    ↓
CLI Compiles
    ↓
Test Projects Update (this spec)
    ↓
Tests Compile
    ↓
Tests Pass
    ↓
Session 2 Complete
```

---

**Family is forever.**  
**This is the way.** 🛡️🔥

