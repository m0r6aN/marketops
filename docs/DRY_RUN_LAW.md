# 🔒 MarketOps Dry Run Law

**Status:** ✅ Implemented & Tested (35/35 tests passing)

## Overview

MarketOps implements a **true dry-run mode** that executes the identical pipeline as production but produces **zero external side effects**. This is structural reality, not a mock.

## Core Principle

> **Schemas are law. Law lives in omega-core. MarketOps obeys.**

All MarketOps schemas are canonical and immutable in `omega-core/schemas/marketops/`.

## Execution Modes

### `dry_run` (Default)
- Executes identical pipeline stages
- Records all side effect intents
- Produces `PublicationPlan` + `ProofLedger` + `JudgeAdvisoryReceipt`
- **Zero external side effects** (fail-closed)
- Advisory receipts have `enforceable=false` (non-promotable)

### `prod` (Explicit Opt-In)
- Executes identical pipeline stages
- Requires explicit authorization for side effects
- Produces `PublicationPlan` + `ProofLedger`
- Side effects execute only via `LiveSideEffectPort`
- Fail-closed: missing authorization → denied

## Architecture

### SideEffectPort Abstraction
Single boundary for all external side effects:

```
ISideEffectPort (interface)
├── NullSinkSideEffectPort (dry_run)
│   └── Records intents, blocks execution
└── LiveSideEffectPort (prod)
    └── Executes with governance authorization
```

### Pipeline Stages (Identical for Both Modes)
1. **Discover** - Find artifacts
2. **Select** - Choose candidates
3. **Verify** - Validate hashes/manifests
4. **Evaluate** - Run governance policies
5. **Plan** - Generate PublicationPlan + SideEffectIntents
6. **Execute** - Dry run: blocked; Prod: authorized execution
7. **Seal** - Generate ProofLedger

### Artifacts

#### PublicationPlan (Human-Readable)
- Discovered artifacts
- Selected candidates
- Executed checks
- Evaluated policies
- Would-ship / would-not-ship decisions
- Reasons + missing prerequisites

#### ProofLedger (Audit-Grade)
- Input hashes
- Policy set references + versions
- Deterministic stage event hashes
- SideEffectIntent list (dry_run)
- SideEffectReceipt list (prod)

#### JudgeAdvisoryReceipt (Dry Run Only)
- `enforceable=false` (REQUIRED)
- `mode=dry_run` (REQUIRED)
- Non-promotable (rejected by FC/runtime)
- Deterministic, signed like receipts

## Fail-Closed Rules

1. Missing mode → fail
2. Side effect outside SideEffectPort → fail
3. Dry run attempting LiveSideEffectPort → fail
4. Prod without explicit authorization → fail
5. Advisory receipt with `enforceable=true` → fail

## API Surface

```
POST   /marketops/runs              → Start run (mode defaults to dry_run)
GET    /marketops/runs/{id}         → Run summary (includes mode)
GET    /marketops/runs/{id}/plan    → PublicationPlan
GET    /marketops/runs/{id}/ledger  → ProofLedger
GET    /marketops/runs/{id}/advisory → JudgeAdvisoryReceipt (dry_run only)
```

## WebSocket Events (Ordered)

Identical sequence for both modes:
- `marketops.run.started`
- `marketops.stage.started` (per stage)
- `marketops.stage.completed` (per stage)
- `marketops.plan.generated`
- `marketops.ledger.sealed`
- `marketops.execute.blocked` (dry_run only)
- `marketops.judge.advisory_issued` (dry_run only)
- `marketops.judge.receipt_issued` (prod only)
- `marketops.run.completed`

All events include: `run_id`, `mode`, `stage`, `status`, `artifact_refs`, hash pointers.

## Schema Authority

**Canonical Location:** `omega-core/schemas/marketops/`

- `side-effect-intent.schema.json`
- `publication-plan.schema.json`
- `proof-ledger.schema.json`
- `judge-advisory-receipt.schema.json`
- `_index.json` (pack metadata)

**Pinning:** Schemas pinned by `$id` + SHA256 digest. Drift detection → fail fast.

## Test Coverage

✅ **35 tests passing:**
- DryRunLawTests (7 tests)
- ApiControllerTests (7 tests)
- WebSocketEventTests (6 tests)
- SideEffectPortTests (existing)
- OmegaGateTests (existing)

## Key Invariants

```csharp
// Mode is stamped everywhere
public sealed record MarketOpsRun(
    string RunId,
    ExecutionMode Mode,  // ← REQUIRED
    ...);

// Dry run always blocks
if (run.IsDryRun)
    return NullSinkSideEffectPort;  // Records intents only

// Prod requires authorization
if (run.IsProd)
    return LiveSideEffectPort;  // Requires enforceable=true

// Advisory receipts are non-promotable
public sealed record JudgeAdvisoryReceipt(
    ...
    bool Enforceable = false,  // ← MUST be false
    string Mode = "dry_run",   // ← MUST be dry_run
    ...);
```

## Proof of Compliance

1. ✅ Dry run produces zero external side effects (NullSinkSideEffectPort)
2. ✅ Dry run produces PublicationPlan + ProofLedger + JudgeAdvisoryReceipt
3. ✅ Advisory receipts have `enforceable=false` and `mode=dry_run`
4. ✅ Prod mode requires explicit authorization
5. ✅ All side effects route through single boundary (SideEffectPort)
6. ✅ Identical pipeline stages for both modes
7. ✅ Mode is enforced at every boundary
8. ✅ Fail-closed rules are structural, not convention

## Next Steps

1. Integrate with omega-flow frontend (run list, plan viewer, intents table)
2. Implement actual side effect execution in LiveSideEffectPort
3. Connect to Federation Core for authorization validation
4. Deploy to staging for E2E testing

