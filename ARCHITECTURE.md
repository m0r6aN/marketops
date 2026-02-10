# MarketOps Architecture

> **MarketOps proves omega-sdk-csharp.**

---

## High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        MarketOps CLI                            │
│                    (Human / CI Interface)                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     MarketOps.Core                              │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ PublishPacket│  │  GateResult  │  │  Gate Config │          │
│  │   (Packet)   │  │   (Result)   │  │   (Policy)   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  Ports (Interfaces):                                           │
│  • IMarketOpsGate        • IMarketOpsCurator                   │
│  • IMarketOpsObserver    • IMarketOpsPublisher                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ (Port Interface)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   MarketOps.OmegaSdk                            │
│                  (Adapter Layer)                                │
│                                                                 │
│  Ports:                    Adapters:                           │
│  ┌────────────────────┐   ┌─────────────────────┐              │
│  │IGovernanceDecision │──▶│ OmegaDecisionClient │              │
│  │IGovernanceExecution│──▶│OmegaExecutionClient │              │
│  │IGovernanceAuditWrt │──▶│  OmegaAuditWriter   │              │
│  │IGovernanceEvidVer  │──▶│OmegaEvidenceVerifier│              │
│  └────────────────────┘   └─────────────────────┘              │
│                                  │                              │
│                                  ▼                              │
│                         ┌────────────────┐                      │
│                         │   OmegaGate    │                      │
│                         │ (Orchestrator) │                      │
│                         └────────────────┘                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ (SDK Abstraction)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    omega-sdk-csharp                             │
│                                                                 │
│  OmegaClient                                                   │
│  • Tools.InvokeAsync("governance.decide", ...)                 │
│  • Tools.InvokeAsync("governance.execute", ...)                │
│  • Evidence.VerifyAsync(packHash, ...)                         │
│  • Evidence.GetAsync(packHash, ...)                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ (REST + WebSocket)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Federation Core                              │
│                                                                 │
│  • Tool Registry        • Agent Registry                       │
│  • Governance Substrate • Evidence Packs                       │
│  • Governance Substrate Integration     • Audit Trail                        │
└─────────────────────────────────────────────────────────────────┘
```

MarketOps never bypasses the governance substrate. The entire governance path is Governance Substrate → omega-sdk → MarketOps, and every gateway that MarketOps exposes is instrumented to keep that flow one-way.

---

## Adapter Boundary

The adapter boundary is the critical separation between:

- BCL-only types (no external dependencies)
- Pure domain logic
- Generic governance types (`GovernanceEvidence`, not vendor-specific evidence)
- Port interfaces (contracts, not implementations)

**Outside the Boundary (MarketOps.OmegaSdk):**
- SDK-specific implementations
- Tool invocation patterns
- Evidence operations
- HTTP/WebSocket communication (via SDK)

### What Crosses the Boundary
- `PublishPacket` — Input to gate evaluation
- `GateResult` — Output from gate evaluation
- `GovernanceEvidence` — Audit evidence (generic)
- Port interface calls — Decisions, executions, audits

### What NEVER Crosses the Boundary
- `HttpClient` instances
- SDK-specific response types
- Raw JSON payloads
- Connection strings or URLs

---

## What MarketOps Does NOT Do

1. **Does NOT manage HTTP connections** — All network access via omega-sdk-csharp
2. **Does NOT parse raw API responses** — SDK handles deserialization
3. **Does NOT implement canonicalization** — SDK gap (fails closed)
4. **Does NOT download evidence ZIPs** — SDK gap (fails closed)
5. **Does NOT bypass SDK for "efficiency"** — SDK-first is doctrine, not preference
6. **Does NOT host marketing, engagement, or SEO logic** — Proof is the only product.

---

## Anti-goals

MarketOps intentionally avoids:

- Marketing copy, claims, or outreach logic in the repository and runtime.
- Engagement cadence, pass/fail metrics, or conversion-tracking instrumentation.
- SEO/AEO/GEO keyword pushing or platform-specific visibility hacks.

These anti-goals keep the architecture focused on proof, not promotion.

---

## SDK Gaps (Fail-Closed)

| Capability | SDK Status | MarketOps Behavior |
|------------|-----------|-------------------|
| Tool Invocation | ✅ Available | Uses `Tools.InvokeAsync` |
| Evidence Verify | ✅ Available | Uses `Evidence.VerifyAsync` |
| Evidence Get | ✅ Available | Uses `Evidence.GetAsync` |
| Canonicalization | ❌ Missing | Packet hash = `null` |
| Evidence Download | ❌ Missing | Audit write fails closed |
| Evidence Create | ❌ Missing | Audit write fails closed |

---

## Proof Statement

- **MarketOps proves omega-sdk-csharp by consuming it as a downstream validator.**
>
> The governance substrate → omega-sdk → MarketOps lane is the only governance alley, and MarketOps never shortcuts it.
> Every SDK gap discovered in MarketOps is a gap that would affect all consumers.
> Every pattern that works in MarketOps is a pattern validated for production use.

---

*Last updated: 2026-02-01 (Session 3)*
