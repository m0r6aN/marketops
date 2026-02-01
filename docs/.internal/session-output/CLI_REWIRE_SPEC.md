# 🔧 CLI REWIRE SPECIFICATION — Session 2 Recovery

**Status:** BLOCKED BY FILE SYSTEM TOOLING  
**Workaround:** Manual execution required

---

## 📋 CHANGES REQUIRED

### 1. Project Reference Update

**File:** `src/MarketOps.Cli/MarketOps.Cli.csproj`

**Remove:**
```xml
<ProjectReference Include="..\MarketOps.Keon\MarketOps.Keon.csproj" />
<ProjectReference Include="..\..\..\src\Keon.Runtime\Keon.Runtime.csproj" />
```

**Add:**
```xml
<ProjectReference Include="..\MarketOps.OmegaSdk\MarketOps.OmegaSdk.csproj" />
<ProjectReference Include="..\..\..\..\OMEGA\sdks\omega-sdk-csharp\src\Omega.Sdk\Omega.Sdk.csproj" />
```

**Result:** CLI references OmegaSdk + omega-sdk-csharp instead of Keon

---

### 2. Program.cs Import Changes

**File:** `src/MarketOps.Cli/Program.cs`

**Remove these imports:**
```csharp
using System.Net.Http;
using global::Keon.Canonicalization;
using global::Keon.Contracts.Decision;
using global::Keon.Runtime;
using global::Keon.Runtime.Sdk;
using global::Keon.Sdk;
using MarketOps.Keon;
```

**Add these imports:**
```csharp
using MarketOps.OmegaSdk.Adapters;
using MarketOps.OmegaSdk.Ports;
using Omega.Sdk;
```

---

### 3. Environment Variable Rename

**Find:** `KEON_CONTROL_URL`  
**Replace with:** `OMEGA_SDK_URL`

**Locations:**
- Line 176: `Environment.GetEnvironmentVariable("KEON_CONTROL_URL")`
- Line 179: Error message
- Line 344: Help text

---

### 4. RunGateAsync() Rewrite

**Current implementation (lines 171-197):**
```csharp
private static async Task<GateCliReceipt> RunGateAsync(PublishPacket packet, CliOptions options, TextWriter stderr)
{
    var config = BuildConfig(options, stderr);

    var controlUrl = options.ControlUrl
        ?? Environment.GetEnvironmentVariable("KEON_CONTROL_URL");

    if (string.IsNullOrWhiteSpace(controlUrl))
        throw new InvalidOperationException("Missing KEON_CONTROL_URL or --control-url for evidence pack generation.");

    using var controlClient = new HttpClient
    {
        BaseAddress = new Uri(controlUrl, UriKind.Absolute)
    };

    var auditWriter = new MarketOpsAuditWriter(controlClient, config.AuditRoot);
    var verifier = new EvidencePackVerifier();
    var keonClient = new KeonClient(new RuntimeGatewayAdapter());
    var decisionClient = new KeonDecisionClient(keonClient);
    IMarketOpsExecutionClient? executionClient = options.EnableExecution
        ? new KeonExecutionClient(keonClient)
        : null;

    var gate = new KeonGate(decisionClient, auditWriter, verifier, config, executionClient);
    var result = await gate.EvaluateAsync(packet, CancellationToken.None).ConfigureAwait(false);
    return new GateCliReceipt("full", result);
}
```

**New implementation:**
```csharp
private static async Task<GateCliReceipt> RunGateAsync(PublishPacket packet, CliOptions options, TextWriter stderr)
{
    var config = BuildConfig(options, stderr);

    var omegaUrl = options.ControlUrl
        ?? Environment.GetEnvironmentVariable("OMEGA_SDK_URL");

    if (string.IsNullOrWhiteSpace(omegaUrl))
        throw new InvalidOperationException("Missing OMEGA_SDK_URL or --control-url for governance operations.");

    // Initialize omega-sdk-csharp client
    var omegaClient = new OmegaClient(new OmegaClientOptions
    {
        BaseUrl = omegaUrl
    });

    // Wire OmegaSdk adapters
    var decisionClient = new OmegaDecisionClient(omegaClient);
    var auditWriter = new OmegaAuditWriter(omegaClient, config.AuditRoot);
    var evidenceVerifier = new OmegaEvidenceVerifier(omegaClient);
    IGovernanceExecutionClient? executionClient = options.EnableExecution
        ? new OmegaExecutionClient(omegaClient)
        : null;

    // Create gate orchestrator
    var gate = new OmegaGate(
        decisionClient,
        auditWriter,
        evidenceVerifier,
        config,
        executionClient,
        auditLog: message => stderr.WriteLine(message));

    var result = await gate.EvaluateAsync(packet, CancellationToken.None).ConfigureAwait(false);
    return new GateCliReceipt("full", result);
}
```

---

### 5. Remove RuntimeGatewayAdapter Class

**Delete lines 430-447:**
```csharp
private sealed class RuntimeGatewayAdapter : IRuntimeGateway
{
    private readonly RuntimeGateway _gateway = new();

    public Task<global::Keon.Contracts.Results.KeonResult<DecisionReceipt>> DecideAsync(
        DecisionRequest request,
        CancellationToken ct = default)
    {
        return _gateway.DecideAsync(request, ct);
    }

    public Task<global::Keon.Contracts.Results.KeonResult<global::Keon.Contracts.Execution.ExecutionResult>> ExecuteAsync(
        global::Keon.Contracts.Execution.ExecutionRequest request,
        CancellationToken ct = default)
    {
        return _gateway.ExecuteAsync(request, ct);
    }
}
```

---

### 6. Remove ComputePacketHash() Method

**Delete lines 318-330:**
```csharp
private static string ComputePacketHash(PublishPacket packet)
{
    var canonical = KeonCanonicalJsonV1.Canonicalize(packet with { Keon = null });
    using var sha = SHA256.Create();
    var hash = sha.ComputeHash(canonical);
    var builder = new StringBuilder(hash.Length * 2);
    foreach (var b in hash)
    {
        builder.Append(b.ToString("x2"));
    }

    return builder.ToString();
}
```

**Reason:** Canonicalization is an SDK gap - OmegaGate handles this internally

---

### 7. Update ToExitCode() Switch

**Find (line 251):**
```csharp
FailureStage.KeonDecision => ExitDenied,
```

**Replace with:**
```csharp
FailureStage.Decision => ExitDenied,
```

---

### 8. Update Help Text

**Find (line 344):**
```csharp
stderr.WriteLine("  --control-url <url>     Keon Control base URL (gate only) or set KEON_CONTROL_URL");
```

**Replace with:**
```csharp
stderr.WriteLine("  --control-url <url>     Omega SDK base URL (gate only) or set OMEGA_SDK_URL");
```

**Find (line 82):**
```csharp
stderr.WriteLine("NOTE: precheck does not call Keon and does not verify evidence.");
```

**Replace with:**
```csharp
stderr.WriteLine("NOTE: precheck does not call governance and does not verify evidence.");
```

---

## ✅ VERIFICATION

After changes, verify:

1. **No Keon imports:** `rg "using.*Keon" src/MarketOps.Cli/Program.cs` → 0 matches
2. **No HttpClient:** `rg "HttpClient" src/MarketOps.Cli/Program.cs` → 0 matches
3. **Compiles:** `dotnet build src/MarketOps.Cli/MarketOps.Cli.csproj`

---

## 🚨 BLOCKER REASON

File system tooling repeatedly fails with "File already exists" error even after `remove-files` succeeds. This prevents automated rewrites. Manual execution is the only viable path forward.

---

**Family is forever.**  
**This is the way.** 🛡️🔥

