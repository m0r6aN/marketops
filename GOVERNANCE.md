# MarketOps Governance

> **SDK-First is doctrine, not preference.**

---

## Core Doctrines

### 1. SDK-First Doctrine

**All Federation Core access MUST go through omega-sdk-csharp.**

This is not a guideline. This is law.

| Access Type | Allowed | Forbidden |
|-------------|---------|-----------|
| Tool invocation via SDK | ✅ | |
| Evidence operations via SDK | ✅ | |
| Direct HTTP to Federation Core | | ❌ |
| Direct WebSocket connections | | ❌ |
| Embedding SDK internals | | ❌ |

**Rationale:** The SDK is the contract. Bypassing it creates:
- Untested integration paths
- Version drift risks
- Security surface expansion
- Audit trail gaps

---

### 2. Fail-Closed Doctrine

**When SDK capabilities are missing, the system fails gracefully — never bypasses.**

```
┌─────────────────────────────────────────────────────────────────┐
│                      SDK Gap Encountered                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ❌ WRONG: Implement workaround with HttpClient                 │
│  ❌ WRONG: Copy SDK internals into MarketOps                    │
│  ❌ WRONG: Skip the operation silently                          │
│                                                                 │
│  ✅ RIGHT: Return null/failure with clear message               │
│  ✅ RIGHT: Document gap in SDK_GAPS.md                          │
│  ✅ RIGHT: Open issue against omega-sdk-csharp                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Current Fail-Closed Behaviors:**
- `PacketHash` → `null` (no canonicalization utility in SDK)
- `AuditWrite` → fails closed (no `Evidence.CreateAsync` in SDK)
- `EvidenceDownload` → fails closed (no `Evidence.DownloadAsync` in SDK)

---

### 3. Generic Governance Types

**Core types MUST NOT reference vendor-specific implementations.**

| Generic Type | Purpose | NOT This |
|--------------|---------|----------|
| `GovernanceEvidence` | Audit evidence container | ~~Vendor-specific evidence~~ |
| `GovernanceAuditInfo` | Audit metadata | ~~Vendor-specific metadata~~ |
| `VerificationSummary` | Verification result | ~~Vendor-specific verification~~ |
| `FailureStage.Decision` | Decision failure | ~~Vendor-specific failure~~ |

**Rationale:** MarketOps core must remain portable. Today it uses the current governance substrate via omega-sdk-csharp. Tomorrow it might use a different control plane. The adapter layer absorbs this complexity.

--- 

### 4. Zero vendor knowledge

**MarketOps active runtime surfaces must never reference forbidden vendor vocabulary.**

The zero vendor knowledge workflow scans `src/MarketOps`, `src/MarketOps.Cli`, `src/MarketOps.OmegaSdk`, `contracts`, and `docs` for the forbidden patterns that expose legacy dependency tokens. The job excludes `src/legacy`, `REPORT`, and `artifacts`, and any match fails before tests run, keeping the live paths vendor-free.

---

## Evidence Boundaries

### What Lives in the SDK (omega-sdk-csharp)

1. **Canonicalization** — Deterministic hash of packet contents
2. **Evidence ZIP creation** — Bundle decision + execution + metadata
3. **Evidence ZIP download** — Retrieve audit artifacts
4. **Signature verification** — Cryptographic integrity checks

### What Lives in MarketOps

1. **Packet definition** — What gets governed
2. **Gate orchestration** — Decision → Execute → Audit flow
3. **Result interpretation** — Pass/fail/deferred logic
4. **Domain types** — Generic governance abstractions

### Why This Split?

**ZIP/canonicalization complexity does NOT belong in consumers.**

Every consumer implementing their own:
- Creates divergent evidence formats
- Introduces canonicalization bugs
- Expands the attack surface
- Makes auditing impossible

The SDK is the single source of truth for evidence operations.

---

## Enforcement Mechanisms

### 1. Port Boundaries

All SDK access flows through defined ports:
- `IGovernanceDecision` — Decide on packets
- `IGovernanceExecution` — Execute approved packets
- `IGovernanceAuditWriter` — Write audit trails
- `IGovernanceEvidenceVerifier` — Verify evidence integrity

**Violation:** Any code in `MarketOps.Core` importing SDK types.

### 2. Automated Scans

```bash
# Must return ZERO matches in src/MarketOps/
rg -n "HttpClient|WebSocket" src/MarketOps --type cs

# Must return ZERO matches for direct Federation access
rg -n "/mcp/tools|/evidence/" src/MarketOps --type cs

# Vendor references only in adapters

The active code base must not introduce vendor-specific tokens outside of the adapter surface. These ripgrep checks are now materialized as workflow steps. The zero vendor knowledge job runs on every `push`/`pull_request` to `main` with the same path filters, and it exits with failure if forbidden vocabulary is present.

The new `Drift Register Integrity` workflow examines `artifacts/drift-map/DRIFT_REGISTER.md` and `REPORT/DRIFT_REGISTER.md`, ensures the canonical ledger exists, refuses work when placeholder tokens remain, and checks that the snapshot records the canonical hash and a `**Snapshot Created:**` line before the build continues.

### 3. Code Review Checklist

Before any PR merge:
- [ ] No new `HttpClient` in core
- [ ] No SDK type leakage into contracts
- [ ] All SDK gaps documented
- [ ] Fail-closed pattern maintained

---

## Anti-goals

MarketOps explicitly refuses to become a marketing or engagement surface.

- No marketing copy, claims, or storytelling logic in code or docs.
- No cadence, engagement, or conversion metrics baked into runtime decisions.
- No SEO/AEO/GEO keyword pushing or platform-visibility hacks.
- No direct outreach, campaign automation, or growth hooks in MarketOps code.

These anti-goals keep the governance lane narrow and provable.

---

## Amendment Process

This governance document may be amended through:

1. **Session-based changes** — Formal session with documented rationale
2. **SDK evolution** — When omega-sdk-csharp adds capabilities
3. **Pantheon consensus** — Agreement across Titan brothers

Changes require:
- Updated GOVERNANCE.md
- New version tag
- Session documentation

---

*Last updated: 2026-02-01 (Session 3)*
