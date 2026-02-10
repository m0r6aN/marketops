# 🚨 OMEGA SDK GAPS ANALYSIS

**Date:** 2026-02-01  
**SDK Version:** omega-sdk-csharp v1.0.0  
**MarketOps Requirements:** Based on `MarketOps.Keon` adapter analysis

---

## 📊 EXECUTIVE SUMMARY

### ✅ CAPABILITIES PRESENT
- ✅ Tool discovery (`Tools.ListAsync`, `Tools.GetAsync`)
- ✅ Tool invocation (`Tools.InvokeAsync`)
- ✅ Governance receipt binding (`decisionReceiptId` parameter)
- ✅ Evidence pack retrieval (`Evidence.GetAsync`)
- ✅ Evidence pack verification (`Evidence.VerifyAsync`)
- ✅ Correlation ID discipline (automatic `t:{tenant}|c:{uuid7}`)
- ✅ Retry policy with exponential backoff
- ✅ Structured error handling

### ⚠️ GAPS IDENTIFIED
1. **NO DIRECT DECISION API** — No `Decide()` method
2. **NO DIRECT EXECUTION API** — No `Execute()` method
3. **NO CANONICALIZATION UTILITY** — No `Canonicalize()` for packet hashing
4. **NO EVIDENCE PACK DOWNLOAD** — No ZIP download capability
5. **NO EVIDENCE PACK CREATION** — No local pack generation

---

## 🔍 DETAILED GAP ANALYSIS

### GAP 1: NO DIRECT DECISION API ⚠️

**MarketOps Needs:**
```csharp
// From MarketOps.Keon/IMarketOpsDecisionClient.cs
public interface IMarketOpsDecisionClient
{
    Task<KeonResult<DecisionReceipt>> DecideAsync(
        DecisionRequest request, 
        CancellationToken ct = default);
}
```

**Current SDK:**
- ❌ No `client.Decisions.DecideAsync()` namespace
- ❌ No `DecisionRequest` model
- ❌ No `DecisionReceipt` model

**Workaround:**
```csharp
// Use Tools.InvokeAsync to call a "keon.decide" tool
var result = await client.Tools.InvokeAsync(
    toolId: "keon.decide",
    input: new Dictionary<string, object>
    {
        ["capability"] = "marketops.publish",
        ["input"] = decisionInput
    });

// Extract receipt from result.Result dictionary
var receiptId = result.Audit?.KeonReceiptId;
```

**Status:** ⚠️ **WORKAROUND AVAILABLE** (use tool invocation)

**Recommendation:** 
- **Option A:** Add `DecisionsNamespace` to SDK
- **Option B:** Document tool-based decision pattern
- **Option C:** MarketOps adapter wraps tool invocation

---

### GAP 2: NO DIRECT EXECUTION API ⚠️

**MarketOps Needs:**
```csharp
// From MarketOps.Keon/IMarketOpsExecutionClient.cs
public interface IMarketOpsExecutionClient
{
    Task<KeonResult<ExecutionResult>> ExecuteAsync(
        ExecutionRequest request, 
        CancellationToken ct = default);
}
```

**Current SDK:**
- ❌ No `client.Executions.ExecuteAsync()` namespace
- ❌ No `ExecutionRequest` model
- ❌ No `ExecutionResult` model

**Workaround:**
```csharp
// Use Tools.InvokeAsync to call a "keon.execute" tool
var result = await client.Tools.InvokeAsync(
    toolId: "keon.execute",
    input: new Dictionary<string, object>
    {
        ["target"] = executionTarget,
        ["parameters"] = executionParams
    },
    decisionReceiptId: decisionReceiptId);
```

**Status:** ⚠️ **WORKAROUND AVAILABLE** (use tool invocation)

**Recommendation:** Same as GAP 1

---

### GAP 3: NO CANONICALIZATION UTILITY 🚨

**MarketOps Needs:**
```csharp
// From MarketOps.Keon/KeonGate.cs (line 360)
var canonical = KeonCanonicalJsonV1.Canonicalize(packet with { Keon = null });
using var sha = SHA256.Create();
var hash = sha.ComputeHash(canonical);
```

**Current SDK:**
- ❌ No `Canonicalize()` method
- ❌ No canonical JSON serialization utility

**Available in SDK:**
```csharp
// FederationClient.cs has JcsCanonicalizer (line 84-95)
public class JcsCanonicalizer
{
    public static string Canonicalize(object? obj) =>
        JsonSerializer.Serialize(obj, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true,
            WriteIndented = false,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        });
}
```

**Status:** ⚠️ **PARTIAL** (JCS available in `FederationClient`, not in `OmegaClient`)

**Recommendation:**
- **Option A:** Expose `JcsCanonicalizer` as public utility in `Omega.Sdk.Utils`
- **Option B:** MarketOps adapter copies canonicalization logic
- **Option C:** Add `Canonicalize()` extension method to `OmegaClient`

---

### GAP 4: NO EVIDENCE PACK DOWNLOAD (ZIP) 🚨

**MarketOps Needs:**
```csharp
// From MarketOps.Keon/MarketOpsAuditWriter.cs (lines 97-102)
var zipBytes = await _controlClient.GetByteArrayAsync(
    $"/compliance/evidence-packs/{metadata.PackId}/download",
    ct).ConfigureAwait(false);

var zipPath = Path.Combine(outputDir, $"evidence-pack-{metadata.PackId}.zip");
await File.WriteAllBytesAsync(zipPath, zipBytes, ct).ConfigureAwait(false);
```

**Current SDK:**
```csharp
// Evidence.GetAsync returns MemoryEvidencePack (in-memory JSON)
public async Task<MemoryEvidencePack> GetAsync(string packHash, ...);
```

- ❌ No ZIP download capability
- ❌ No `DownloadAsync(packHash, outputPath)` method

**Status:** 🚨 **MISSING** (critical for MarketOps audit trail)

**Recommendation:**
- **Option A:** Add `Evidence.DownloadAsync(packHash, outputPath)` to SDK
- **Option B:** MarketOps adapter uses raw HTTP to download ZIP
- **Option C:** Add `Evidence.GetBytesAsync(packHash)` for raw blob access

---

### GAP 5: NO EVIDENCE PACK CREATION 🚨

**MarketOps Needs:**
```csharp
// From MarketOps.Keon/MarketOpsAuditWriter.cs (lines 84-92)
var response = await _controlClient.PostAsJsonAsync(
    "/compliance/evidence-packs",
    request,
    cancellationToken: ct).ConfigureAwait(false);

var metadata = await response.Content.ReadFromJsonAsync<EvidencePackMetadata>(...);
```

**Current SDK:**
- ❌ No `Evidence.CreateAsync()` method
- ❌ No evidence pack generation API

**Status:** 🚨 **MISSING** (critical for MarketOps audit trail)

**Recommendation:**
- **Option A:** Add `Evidence.CreateAsync(request)` to SDK
- **Option B:** MarketOps adapter uses raw HTTP to create packs
- **Option C:** Evidence pack creation is handled by Federation Core automatically

---

## 🎯 PRIORITIZED RECOMMENDATIONS

### CRITICAL (MUST HAVE)
1. **Evidence Pack Download** — Add `Evidence.DownloadAsync(packHash, outputPath)`
2. **Evidence Pack Creation** — Add `Evidence.CreateAsync(request)` or document auto-creation
3. **Canonicalization Utility** — Expose `JcsCanonicalizer` as public API

### HIGH (SHOULD HAVE)
4. **Decision API** — Add `DecisionsNamespace` or document tool-based pattern
5. **Execution API** — Add `ExecutionsNamespace` or document tool-based pattern

### MEDIUM (NICE TO HAVE)
6. **Typed Models** — Add `DecisionRequest`, `DecisionReceipt`, `ExecutionRequest`, `ExecutionResult`
7. **Governance Helpers** — Add `GovernanceContext` builder utilities

---

## 🛠️ WORKAROUND STRATEGY (IMMEDIATE)

### For MarketOps.OmegaSdk Adapter

**Decision Client:**
```csharp
public class OmegaDecisionClient : IGovernanceDecisionClient
{
    private readonly OmegaClient _client;
    
    public async Task<GovernanceDecisionResult> DecideAsync(
        GovernanceDecisionRequest request, 
        CancellationToken ct = default)
    {
        // Invoke "keon.decide" tool
        var result = await _client.Tools.InvokeAsync(
            toolId: "keon.decide",
            input: MapToToolInput(request),
            decisionReceiptId: null,
            ct: ct);
        
        return MapFromToolResult(result);
    }
}
```

**Audit Writer:**
```csharp
public class OmegaAuditWriter : IGovernanceAuditWriter
{
    private readonly OmegaClient _client;
    private readonly HttpClient _httpClient; // ⚠️ FALLBACK for ZIP download
    
    public async Task<AuditPaths> WriteReceiptAndPackAsync(...)
    {
        // 1. Create evidence pack via tool invocation or raw HTTP
        // 2. Download ZIP via raw HTTP (SDK gap)
        // 3. Write to local filesystem
    }
}
```

**Canonicalization:**
```csharp
// Copy JcsCanonicalizer from FederationClient.cs
internal static class OmegaCanonicalizer
{
    public static byte[] Canonicalize(object obj)
    {
        var json = JsonSerializer.Serialize(obj, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        });
        return Encoding.UTF8.GetBytes(json);
    }
}
```

---

## ✅ CONCLUSION

**SDK is 70% READY for MarketOps integration.**

**Critical Gaps:**
1. Evidence pack download (ZIP)
2. Evidence pack creation
3. Canonicalization utility

**Workarounds Available:**
- Decision/Execution via tool invocation ✅
- Canonicalization via copied utility ✅
- Evidence download via raw HTTP ⚠️ (breaks SDK abstraction)

**Recommendation:** Proceed with adapter implementation using workarounds, but **REPORT SDK GAPS** to OMEGA team for future enhancement.

---

**END OF GAP ANALYSIS**

