# MarketOps Parallel Lanes

## Core Rule

No lane may depend on another lane's unmerged work.

If a dependency exists, the work is not parallel-ready. Resolve it as one of:

- a later integration PR
- a shared contract or spec PR first
- a stubbed interface
- a fixture-backed placeholder

## What PR 0 Provides

PR 0 exports shared contracts only.

PR 0 does not:

- refactor `src/lib/initiatives.ts`
- refactor `src/lib/campaigns.ts`
- migrate existing initiative models
- migrate existing campaign models
- change existing `/initiatives` behavior
- change existing `/campaigns` behavior
- add live integrations
- add database or schema coupling
- add policy evaluation or execution gating

Existing `src/lib/initiatives.ts`, `src/lib/campaigns.ts`, `/initiatives`, and `/campaigns` remain behaviorally unchanged in PR 0.

The new MarketOps `Campaign` contract is future-canonical. Existing campaign fixtures remain unchanged until a later integration PR migrates runtime consumers onto the shared contract layer.

## Canonical Imports For Feature Lanes

After PR 0 lands and merges, downstream feature lanes start from latest `main`.

Import canonical shared contracts from the barrel seam:

`src/lib/marketops`

Do not import canonical shared contracts from ad hoc subpaths in feature-lane code. Use underlying files for inspection and source-of-truth understanding, but use the barrel seam for feature-lane imports.

Feature lanes should import shared contract types from that barrel seam, including:

- `Initiative`
- `Medium`
- `Campaign`
- `ContentAsset`
- `Persona`
- `Agent`
- `OperatorAlert`
- `Integration`
- `Receipt`
- `AutomationPolicy`
- `ApprovalState`

Do not invent conflicting duplicate types. If a lane needs UI-only shaping, create a lane-local view model only when necessary, and make it map back to the canonical contracts.

## Downstream Agent Workflow

Downstream agents should start after PR 0 lands and merges, then inspect `src/lib/marketops` and `docs/marketops/PARALLEL-LANES.md` on latest `main` first.

Start with:

```powershell
Get-ChildItem src/lib/marketops
Get-Content src/lib/marketops/entities.ts
Get-Content src/lib/marketops/status.ts
Get-Content src/lib/marketops/automation-levels.ts
Get-Content docs/marketops/PARALLEL-LANES.md
```

Do not rely on pasted type names alone. Inspect the underlying files on latest `main` to understand the source of truth, then import canonical shared contracts from `src/lib/marketops`.

If a required field or type is missing, do not silently invent a conflicting duplicate. Create a lane-local view model or report the contract gap.

## Future Integration PR

After PR 0 lands and dependent feature lanes confirm import expectations, create a follow-up integration PR that:

- migrates existing initiative models to the shared MarketOps contracts
- migrates existing campaign models to the shared MarketOps contracts
- updates runtime consumers in small, explicit slices

Until that integration PR lands, existing fixtures and current route behavior remain unchanged.
