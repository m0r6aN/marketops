# MarketOps Operating Model Foundation Design

## Summary

PR 0 establishes the first shared MarketOps contract layer for the dogfood operating model:

- MarketOps manages Keon
- Keon governs MarketOps automation
- MarketOps produces receipts proving the ecosystem works
- Collective proposes dream offers
- Humans approve
- Agents execute
- Receipts prove what happened

This PR is strictly additive. It creates stable TypeScript contracts and operating-model documentation that later lanes may import. It does not refactor existing initiative or campaign modules, does not migrate runtime behavior, and does not introduce automation, integrations, persistence, or new platform coupling.

## Goals

- Define a shared MarketOps contract layer under `src/lib/marketops/`.
- Establish common domain language for future lanes:
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
- Define shared enums and status vocabularies for later import.
- Provide static fixture-backed examples that demonstrate intended contract shape without driving runtime behavior.
- Document the operating model and the rules for parallel implementation lanes.
- Optionally add isolated placeholder routes only for currently missing screens, if they can compile without touching existing behavior.
- Prefer no global navigation changes in PR 0 unless a change is isolated, trivial, and necessary.

## Non-Goals

- Refactoring `src/lib/initiatives.ts`
- Refactoring `src/lib/campaigns.ts`
- Migrating existing initiative or campaign data models to the new shared contracts
- Changing behavior of `/initiatives`
- Changing behavior of `/campaigns`
- Replacing existing routes with placeholders
- Broad or opportunistic global navigation changes
- Adding live integrations
- Adding OAuth, Stripe, Azure, email, LinkedIn, or Keon runtime calls
- Adding database or schema coupling
- Executing or simulating automation beyond static fixtures
- Introducing vendor-specific or platform-specific logic into the contract layer

## Product Framing

MarketOps is no longer framed as generic marketing software. It is the first real Keon dogfood product and the visible proof loop for the ecosystem.

The operating model is:

1. Collective proposes offers, campaigns, and assets.
2. Humans approve according to policy.
3. Agents execute within bounded capability levels.
4. MarketOps records receipts.
5. Receipts prove the mechanism worked.
6. Keon is the governing layer for higher-automation execution, but PR 0 only names that boundary. It does not implement it.

This language should appear in documentation and shared types, not in live runtime integrations yet.

## Architecture

### Contract layer

Create a new additive domain folder:

- `src/lib/marketops/entities.ts`
- `src/lib/marketops/status.ts`
- `src/lib/marketops/permissions.ts`
- `src/lib/marketops/automation-levels.ts`
- `src/lib/marketops/sample-data.ts`

Optional:

- `src/lib/marketops/index.ts`

The contract layer is intentionally static and dependency-light:

- no imports from current initiative/campaign fixture modules
- no database access
- no API calls
- no environment-variable requirements
- no UI dependencies

Future feature lanes may import these contracts directly or use the sample fixtures while waiting for integration PRs.

### Documentation layer

Create:

- `docs/marketops/OPERATING-MODEL.md`
- `docs/marketops/PARALLEL-LANES.md`

These docs define the intended machine and the parallel-lane rules so later agents can work from a stable written contract instead of tribal knowledge.

### Placeholder route policy

Placeholder routes are allowed only if all of the following are true:

- the route does not already exist
- the page can be created in isolation
- the page is clearly marked as a placeholder
- the page does not alter existing navigation behavior unless nav wiring is trivial and low-conflict

Global nav changes should be avoided by default. If any nav wiring is added, it must be isolated, trivial, and necessary for reaching a newly added placeholder route. Prefer no nav changes.

Candidate placeholder routes:

- `/mediums`
- `/content`
- `/personas`
- `/agents`
- `/operator-inbox`
- `/integrations`
- `/receipts`

Existing `/initiatives` and `/campaigns` must remain untouched.

## Type Design

### `entities.ts`

This file will export the core structural types only.

Expected entities:

- `Initiative`
  - identity, name, description, status, risk, linked campaigns, linked mediums
- `Medium`
  - identity, name, category, surface, owner, associated campaigns or assets
- `Campaign`
  - identity, initiative reference, medium references, execution goal, approval state, risk, automation policy reference
- `ContentAsset`
  - identity, asset type, status, owner, medium reference, campaign reference, receipt references
- `Persona`
  - identity, name, role, needs, constraints, target initiatives or campaigns
- `Agent`
  - identity, display name, capabilities, risk ceiling, approval requirement, active status
- `OperatorAlert`
  - identity, severity, title, message, related entity references, created timestamp
- `Integration`
  - identity, name, status, category, last-checked metadata, required approvals
- `Receipt`
  - identity, kind, subject references, timestamps, proof summary, verification state
- `AutomationPolicy`
  - identity, automation level, approval requirement, allowed capabilities, escalation rule
- `ApprovalState`
  - identity or shape for requested-by, reviewed-by, decision, decided-at, notes

These should be future-friendly but conservative. PR 0 should prefer plain object types and string unions imported from shared enum files over complex generic abstractions.

Shared entity-shape conventions:

- use `id` for opaque durable identifiers
- use `slug`, `name`, `displayName`, and `label` for human-readable values
- fields ending in `Id` must never contain human-readable names or slugs
- route-facing entities should include `id`, `slug`, and `name` or `displayName` where appropriate
- where timestamps are needed, prefer optional ISO-8601 string fields named `createdAt` and `updatedAt`

### `status.ts`

This file will centralize shared enum or union vocabularies:

- `InitiativeStatus`
- `MediumCategory`
- `MediumSurface`
- `ApprovalRequirement`
- `RiskLevel`
- `IntegrationStatus`
- `ReceiptKind`
- `AgentCapability`
- `AlertSeverity`

The values should be stable and operational, not vendor-shaped.

### `automation-levels.ts`

This file defines `AutomationLevel` and the semantics that later lanes will rely on when deciding whether execution is:

- manual only
- human-approved but agent-assisted
- governed automation
- fully blocked pending policy or review

PR 0 only defines the vocabulary and static mapping helpers or labels if needed. It does not execute policy.

This file may include labels and descriptions for automation levels, but it must not implement policy evaluation, execution eligibility, or runtime gating logic in PR 0.

### `permissions.ts`

This file defines coarse permission names and role-facing action groups for future UI and API seams. It should stay generic enough to avoid binding the app to a specific auth provider or tenant model.

Examples include permissions around:

- viewing initiatives
- editing campaigns
- approving automation
- viewing receipts
- resolving operator alerts
- managing integrations

### `sample-data.ts`

This file provides obviously static fixtures that use the new contracts:

- one or more example initiatives
- one example campaign
- one example medium
- one example agent
- one example receipt
- one example automation policy

The fixtures should demonstrate the intended ecosystem loop without being wired into existing runtime pages.

`sample-data.ts` should include a top-level warning comment stating that the file is fixture-only and must not drive production behavior without a later integration PR.

## Documentation Content

### `docs/marketops/OPERATING-MODEL.md`

This document should explain:

- the MarketOps and Keon relationship
- the proposal -> approval -> execution -> receipt loop
- what each core entity represents
- what receipts prove and what they do not prove
- why approvals exist
- why automation levels exist
- why PR 0 is contract-only

The tone should be operational and precise, not promotional.

### `docs/marketops/PARALLEL-LANES.md`

This document should explain:

- no lane may depend on another lane's unmerged work
- if a dependency exists, it becomes:
  - a later integration PR
  - a shared contract/spec PR first
  - a stubbed interface
  - a fixture-backed placeholder
- PR 0 exports shared contracts only
- existing `src/lib/initiatives.ts`, `src/lib/campaigns.ts`, `/initiatives`, and `/campaigns` remain behaviorally unchanged in PR 0
- later lanes may import shared contracts from `src/lib/marketops/*`
- future integration PR:
  - migrate existing initiative and campaign data models to shared MarketOps contracts after PR 0 lands and after dependent feature lanes confirm import expectations
- the new MarketOps `Campaign` contract is future-canonical, while the existing campaign fixtures remain unchanged until a later integration PR

This document should also include a dedicated canonical-imports section for downstream agents:

- canonical imports for feature lanes:
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
- import from:
  - `src/lib/marketops`
- feature lanes may create local UI view models only when necessary, but those view models must reference or map back to the canonical contract types
- best practice: each downstream agent should first inspect:
  - `ls src/lib/marketops`
  - `sed -n '1,220p' src/lib/marketops/entities.ts`
  - `sed -n '1,220p' src/lib/marketops/status.ts`
  - `sed -n '1,220p' src/lib/marketops/automation-levels.ts`
  - `sed -n '1,220p' docs/marketops/PARALLEL-LANES.md`
- downstream agents must not rely on pasted type names alone
- they should inspect `src/lib/marketops` and `docs/marketops/PARALLEL-LANES.md` on latest `main`, then use the canonical exported contracts
- if a needed field or type is missing, the lane must not silently invent a conflicting duplicate
- instead, create a lane-local view model or report the contract gap to the orchestrator

## File Boundaries

### Files created

- `src/lib/marketops/entities.ts`
- `src/lib/marketops/status.ts`
- `src/lib/marketops/permissions.ts`
- `src/lib/marketops/automation-levels.ts`
- `src/lib/marketops/sample-data.ts`
- `docs/marketops/OPERATING-MODEL.md`
- `docs/marketops/PARALLEL-LANES.md`

Optional:

- `src/lib/marketops/index.ts`
- isolated placeholder route files for missing screens only

### Files intentionally not modified

- `src/lib/initiatives.ts`
- `src/lib/campaigns.ts`
- existing `/initiatives` route files
- existing `/campaigns` route files

## Error Handling

This PR is mostly static, so error handling is minimal by design:

- contract files should compile cleanly with no runtime dependencies
- placeholder pages, if added, should render simple static content and metadata only
- no data fetching, mutation, or automation failure modes are introduced here

## Testing and Verification

Required verification:

- `npm run typecheck`
- `npm run build`
- `git diff --check`

If placeholder routes are added, they must compile as part of the normal build.

The final implementation report for PR 0 should include:

- changed files
- validation commands run
- validation results
- explicit statement that existing initiative/campaign/runtime behavior was not changed
- current worktree status

## Follow-Up Work

PR 0 is a base-layer merge. It intentionally leaves integration work for later explicit PRs.

Expected follow-up lanes include:

- migrate initiative models to shared contracts
- migrate campaign models to shared contracts
- introduce mediums, personas, agents, integrations, and receipts surfaces behind isolated feature PRs
- decide whether placeholder routes should become live operator screens or stay dormant until backed by real feature slices
