# 🔍 OMEGA SDK C# SURFACE ANALYSIS

**SDK Location:** `D:\Repos\OMEGA\sdks\omega-sdk-csharp`  
**Target Framework:** .NET 10.0  
**Date:** 2026-02-01

---

## 📦 SDK STRUCTURE

### Main Entry Point: `OmegaClient`

```csharp
namespace Omega.Sdk;

public sealed class OmegaClient : IAsyncDisposable
{
    // API Namespaces
    public ToolsNamespace Tools { get; }
    public AgentsNamespace Agents { get; }
    public TasksNamespace Tasks { get; }
    public EvidenceNamespace Evidence { get; }
    
    // Health & Status
    public Task<HealthStatus> HealthAsync(CancellationToken ct = default);
    public Task<StatusResponse> StatusAsync(...);
    
    // WebSocket
    public OmegaWebSocketClient CreateWebSocketClient(IWebSocketEventHandler? handler = null);
}
```

---

## 🔧 DISCOVERY CAPABILITIES

### 1. **Tool Discovery** (`ToolsNamespace`)

**Namespace:** `Omega.Sdk.Namespaces.ToolsNamespace`

```csharp
public sealed class ToolsNamespace
{
    /// <summary>
    /// Lists available tools with pagination and filtering.
    /// </summary>
    public async Task<ToolListResponse> ListAsync(
        string? tenantId = null,
        string? actorId = null,
        string? correlationId = null,
        string? capability = null,      // Filter by capability
        string? agentId = null,          // Filter by provider agent
        string? tag = null,              // Filter by tag
        int limit = 50,
        string? cursor = null,
        CancellationToken ct = default);
    
    /// <summary>
    /// Gets tool details by ID.
    /// </summary>
    public async Task<Tool> GetAsync(
        string toolId,
        string? tenantId = null,
        string? actorId = null,
        string? correlationId = null,
        CancellationToken ct = default);
}
```

**Response Models:**

```csharp
public sealed record ToolListResponse(
    IReadOnlyList<Tool> Items,
    Page Page);

public sealed record Tool(
    string ToolId,
    string AgentId,
    ToolStatus Status,
    string? DisplayName = null,
    string? Description = null,
    string? SchemaVersion = null,
    JsonDocument? InputSchema = null,
    JsonDocument? OutputSchema = null,
    IReadOnlyList<string>? Tags = null,
    ToolLimits? Limits = null);
```

### 2. **Agent Discovery** (`AgentsNamespace`)

**Namespace:** `Omega.Sdk.Namespaces.AgentsNamespace`

```csharp
public sealed class AgentsNamespace
{
    public async Task<AgentListResponse> ListAsync(...);
    public async Task<Agent> GetAsync(string agentId, ...);
}
```

---

## ⚡ INVOCATION CAPABILITIES

### 1. **Tool Invocation** (`ToolsNamespace`)

```csharp
public sealed class ToolsNamespace
{
    /// <summary>
    /// Invokes a tool synchronously.
    /// </summary>
    public async Task<ToolInvokeResult> InvokeAsync(
        string toolId,
        Dictionary<string, object> input,
        string? tenantId = null,
        string? actorId = null,
        string? correlationId = null,
        string? decisionReceiptId = null,    // ✅ GOVERNANCE BINDING
        int? timeoutMs = null,
        bool stream = false,
        IReadOnlyList<string>? tags = null,
        CancellationToken ct = default);
}
```

**Request Model:**

```csharp
public sealed record ToolInvokeRequest(
    Dictionary<string, object> Input,
    ToolInvokeContext Context,
    ToolInvokeOptions? Options = null);

public sealed record ToolInvokeContext(
    string TenantId,
    string ActorId,
    string CorrelationId,
    string? DecisionReceiptId = null,    // ✅ GOVERNANCE RECEIPT BINDING
    IReadOnlyList<string>? Tags = null);
```

**Response Model:**

```csharp
public sealed record ToolInvokeResult(
    string ToolId,
    Dictionary<string, object> Result,
    Dictionary<string, object>? Usage = null,
    ToolInvokeAudit? Audit = null);

public sealed record ToolInvokeAudit(
    string EventId,
    string? KeonReceiptId = null,        // ✅ KEON RECEIPT RETURNED
    string? EvidencePackId = null);      // ✅ EVIDENCE PACK ID
```

---

## 🔐 PASSPORT BINDING / SIGNED INVOKE

### **FederationClient** (Alternative High-Level Client)

**File:** `FederationClient.cs`

```csharp
namespace Omega.Sdk;

public class FederationClient : IAsyncDisposable
{
    /// <summary>
    /// List available MCP tools from Federation Core.
    /// </summary>
    public async Task<List<Dictionary<string, object?>>> ListToolsAsync(
        CancellationToken ct = default);
    
    /// <summary>
    /// Invoke an MCP tool with security (HMAC-SHA256 signature).
    /// </summary>
    public async Task<Dictionary<string, object?>> InvokeToolAsync(
        string toolName,
        Dictionary<string, object?>? payload = null,
        CancellationToken ct = default);
}
```

**Signed Request Model:**

```csharp
public record SignedInvokeRequest
{
    public required string PassportId { get; init; }      // ✅ PASSPORT BINDING
    public required string ToolName { get; init; }
    public required Dictionary<string, object?> Payload { get; init; }
    public required long TimestampMs { get; init; }
    public required string Nonce { get; init; }
    public required string Signature { get; init; }       // ✅ HMAC-SHA256
    public string SdkName { get; init; } = "omega-sdk-csharp";
    public string SdkVersion { get; init; } = "1.0.0";
    
    public Dictionary<string, string> ToHeaders() => new()
    {
        { "X-Omega-Passport", PassportId },
        { "X-Omega-Timestamp", TimestampMs.ToString() },
        { "X-Omega-Nonce", Nonce },
        { "X-Omega-Signature", Signature },
        { "X-Omega-SDK", $"{SdkName}/{SdkVersion}" }
    };
}
```

**Signature Algorithm:**

```csharp
// Canonical string for signing
var canonicalString = $"POST\n/mcp/tools/invoke\n{timestampMs}\n{nonce}\n{canonicalBody}";

// HMAC-SHA256 signature
using var hmac = new HMACSHA256(secretBytes);
var signatureBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(canonicalString));
var signature = Convert.ToBase64String(signatureBytes);
```

---

## 📋 EVIDENCE & AUDIT CAPABILITIES

### **EvidenceNamespace**

```csharp
public sealed class EvidenceNamespace
{
    /// <summary>
    /// Lists evidence packs with pagination.
    /// </summary>
    public async Task<EvidencePackListResponse> ListAsync(
        string? tenantId = null,
        string? actorId = null,
        string? correlationId = null,
        string? filterCorrelationId = null,
        int limit = 50,
        string? cursor = null,
        CancellationToken ct = default);
    
    /// <summary>
    /// Gets a complete evidence pack by hash.
    /// </summary>
    public async Task<MemoryEvidencePack> GetAsync(
        string packHash,
        ...);
    
    /// <summary>
    /// Verifies an evidence pack's integrity.
    /// </summary>
    public async Task<EvidenceVerificationResult> VerifyAsync(
        string packHash,
        ...);
}
```

**Evidence Pack Model:**

```csharp
public sealed record MemoryEvidencePack(
    string PackId,
    string PackVersion,
    string CanonVersion,
    DateTimeOffset SealedAt,
    EvidencePackStatus Status,
    IntegrityScope? IntegrityScope = null,
    IdentitySection? Identity = null,
    OperationSection? Operation = null,
    AuthoritySection? Authority = null,       // ✅ CONTAINS DECISION RECEIPT
    StateSection? State = null,
    ExecutionSection? Execution = null,
    ComplianceSection? Compliance = null,
    VerificationSection? Verification = null);

public sealed record AuthoritySection(
    string? PolicyId = null,
    string? DecisionReceiptId = null,         // ✅ KEON RECEIPT ID
    string? Certification = null,
    Dictionary<string, object>? ReceiptData = null);
```

---

## 🎯 USAGE EXAMPLES

### Example 1: Discover Tools

```csharp
var client = new OmegaClient(new OmegaOptions
{
    FederationUrl = "http://localhost:9405",
    TenantId = "keon-public",
    ActorId = "operator-marketops"
});

// List all tools
var tools = await client.Tools.ListAsync();

foreach (var tool in tools.Items)
{
    Console.WriteLine($"{tool.ToolId}: {tool.DisplayName}");
}
```

### Example 2: Invoke Tool (Governance-Bound)

```csharp
// Invoke with decision receipt binding
var result = await client.Tools.InvokeAsync(
    toolId: "keon.decide",
    input: new Dictionary<string, object>
    {
        ["capability"] = "marketops.publish",
        ["input"] = publishPacket
    },
    decisionReceiptId: "receipt-12345",  // ✅ Governance binding
    tags: new[] { "pipeline=marketops", "stage=gate" });

// Check audit trail
if (result.Audit?.KeonReceiptId != null)
{
    Console.WriteLine($"Keon Receipt: {result.Audit.KeonReceiptId}");
}
```

### Example 3: Verify Evidence Pack

```csharp
var verifyResult = await client.Evidence.VerifyAsync(packHash);

if (verifyResult.IsValid)
{
    Console.WriteLine($"✅ Evidence pack verified: {verifyResult.Verdict}");
}
else
{
    Console.WriteLine($"❌ Verification failed: {verifyResult.Details}");
}
```

---

**END OF SURFACE ANALYSIS**

