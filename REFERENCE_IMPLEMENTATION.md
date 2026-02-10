# MarketOps — Reference Implementation Guide

> **MarketOps exists to prove omega-sdk-csharp works.**

---

## Why MarketOps Exists

MarketOps is not a product. It is a **measuring instrument**.

```
┌─────────────────────────────────────────────────────────────────┐
│                    The SDK Validation Problem                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  How do you know omega-sdk-csharp works?                       │
│                                                                 │
│  ❌ Unit tests alone     → Don't prove integration             │
│  ❌ Documentation alone  → Doesn't prove execution             │
│  ❌ Internal testing     → Doesn't prove consumer patterns     │
│                                                                 │
│  ✅ MarketOps            → Real consumer, real patterns,       │
│                            real gaps discovered                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**MarketOps is the first non-trivial consumer of omega-sdk-csharp.**

Every pattern that works here is validated for production.
Every gap discovered here affects all consumers.

---

## What MarketOps Proves

### 1. Tool Invocation Pattern
```csharp
// This pattern is proven to work:
var result = await _client.Tools.InvokeAsync("keon.decide", new {
    packHash = packet.Hash,
    actor = packet.Actor,
    action = packet.Action
});
```

### 2. Evidence Verification Pattern
```csharp
// This pattern is proven to work:
var verification = await _client.Evidence.VerifyAsync(packHash);
```

### 3. Adapter Layering Pattern
```csharp
// Port interface in core:
public interface IGovernanceDecision {
    Task<DecisionResult> DecideAsync(PublishPacket packet);
}

// Adapter in MarketOps.OmegaSdk:
public class OmegaDecisionClient : IGovernanceDecision {
    public async Task<DecisionResult> DecideAsync(PublishPacket packet) {
        // SDK calls here, not in core
    }
}
```

### 4. Fail-Closed Pattern
```csharp
// When SDK lacks capability:
public string? ComputeHash(PublishPacket packet) {
    // SDK has no canonicalization utility
    // Fail closed: return null, document gap
    return null;
}
```

---

## How SDK Gaps Were Surfaced

### Discovery Process

1. **Attempt to implement feature using SDK**
2. **SDK lacks required capability**
3. **Document gap in REPORT/SDK_GAPS.md**
4. **Implement fail-closed behavior**
5. **Open issue against omega-sdk-csharp**

### Gaps Discovered (v0.1.0-omega-decoupled)

| Gap | Impact | Fail-Closed Behavior |
|-----|--------|---------------------|
| No `Canonicalization` utility | Cannot compute packet hash | `Hash = null` |
| No `Evidence.CreateAsync` | Cannot write audit evidence | Audit write returns failure |
| No `Evidence.DownloadAsync` | Cannot retrieve evidence ZIPs | Evidence download unavailable |

### Gap Resolution Flow

```
MarketOps discovers gap
        ↓
Documents in SDK_GAPS.md
        ↓
Opens issue on omega-sdk-csharp
        ↓
SDK team implements
        ↓
MarketOps removes fail-closed code
        ↓
MarketOps proves new capability
```

---

## How Teams Should Use MarketOps

### As a Validator

Before releasing omega-sdk-csharp changes:
1. Run MarketOps build: `dotnet build MarketOps.sln -c Release`
2. Run MarketOps tests: `dotnet test MarketOps.sln -c Release`
3. Verify no regressions

### As a Pattern Library

When implementing SDK consumers:
1. Reference `MarketOps.OmegaSdk/Adapters/` for patterns
2. Follow port/adapter separation
3. Use generic governance types

### As a Gap Detector

When adding SDK features:
1. Check if MarketOps has fail-closed code for that gap
2. Remove fail-closed code when gap is filled
3. Add test coverage for new capability

---

## Integration Points

### Environment Variables
```bash
OMEGA_SDK_URL=https://federation.example.com
```

### Entry Point
```csharp
// CLI wires up adapters
var client = new OmegaClient(federationUrl);
var gate = new OmegaGate(client);
var result = await gate.EvaluateAsync(packet);
```

### Adapter Registration
```csharp
// DI container setup (if using)
services.AddSingleton<IGovernanceDecision, OmegaDecisionClient>();
services.AddSingleton<IGovernanceExecution, OmegaExecutionClient>();
services.AddSingleton<IGovernanceAuditWriter, OmegaAuditWriter>();
services.AddSingleton<IGovernanceEvidenceVerifier, OmegaEvidenceVerifier>();
```

---

## Version Compatibility

| MarketOps Version | omega-sdk-csharp Version | Status |
|-------------------|-------------------------|--------|
| v0.1.0-omega-decoupled | 1.x (current) | ✅ Validated |

---

*Last updated: 2026-02-01 (Session 3)*

