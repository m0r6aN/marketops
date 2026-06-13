# MarketOps Operating Model Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a strictly additive `src/lib/marketops` contract layer and `docs/marketops` operating-model docs without changing existing initiative, campaign, route, or runtime behavior.

**Architecture:** Create a new static domain module set for shared MarketOps contracts, status vocabularies, permissions, automation-level labels, fixture-only sample data, and a mechanical barrel export. Pair it with operating-model and parallel-lane documentation that tells downstream lanes to import canonical contracts from `src/lib/marketops` and defer integration work to later PRs.

**Tech Stack:** Next.js App Router, TypeScript, npm, Markdown, existing `npm run typecheck` and `npm run build` verification commands.

---

### Task 1: Add Shared Status Vocabularies

**Files:**
- Create: `src/lib/marketops/status.ts`
- Verify: `package.json`

- [ ] **Step 1: Create `src/lib/marketops/status.ts` with the canonical shared vocabularies**

```ts
export const initiativeStatuses = ["proposed", "active", "paused", "archived"] as const;
export type InitiativeStatus = (typeof initiativeStatuses)[number];

export const mediumCategories = ["owned", "earned", "paid", "shared", "internal"] as const;
export type MediumCategory = (typeof mediumCategories)[number];

export const mediumSurfaces = [
  "website",
  "landing-page",
  "email",
  "social",
  "video",
  "document",
  "event",
  "internal-tool",
] as const;
export type MediumSurface = (typeof mediumSurfaces)[number];

export const approvalRequirements = [
  "none",
  "human-review",
  "two-person-review",
  "governed-approval",
] as const;
export type ApprovalRequirement = (typeof approvalRequirements)[number];

export const riskLevels = ["low", "medium", "high", "critical"] as const;
export type RiskLevel = (typeof riskLevels)[number];

export const integrationStatuses = [
  "planned",
  "connected",
  "degraded",
  "disabled",
  "retired",
] as const;
export type IntegrationStatus = (typeof integrationStatuses)[number];

export const receiptKinds = [
  "proposal",
  "approval",
  "execution",
  "publication",
  "verification",
  "alert",
] as const;
export type ReceiptKind = (typeof receiptKinds)[number];

export const agentCapabilities = [
  "propose-offer",
  "prepare-campaign",
  "draft-content",
  "publish-asset",
  "sync-integration",
  "generate-report",
] as const;
export type AgentCapability = (typeof agentCapabilities)[number];

export const alertSeverities = ["info", "warning", "error", "critical"] as const;
export type AlertSeverity = (typeof alertSeverities)[number];
```

- [ ] **Step 2: Run typecheck to verify the new vocabulary file compiles cleanly**

Run: `npm run typecheck`
Expected: PASS with no TypeScript errors from `src/lib/marketops/status.ts`

- [ ] **Step 3: Commit the vocabulary file once typecheck is green**

```bash
git add src/lib/marketops/status.ts
git commit -m "feat: add marketops status vocabularies"
```

### Task 2: Add Automation-Level Labels and Permission Names

**Files:**
- Create: `src/lib/marketops/automation-levels.ts`
- Create: `src/lib/marketops/permissions.ts`
- Verify: `src/lib/marketops/status.ts`

- [ ] **Step 1: Create `src/lib/marketops/automation-levels.ts` as a labels-only contract file**

```ts
export const automationLevels = [
  "manual-only",
  "human-approved",
  "governed-automation",
  "blocked",
] as const;

export type AutomationLevel = (typeof automationLevels)[number];

export type AutomationLevelDefinition = {
  level: AutomationLevel;
  label: string;
  description: string;
};

export const automationLevelDefinitions: readonly AutomationLevelDefinition[] = [
  {
    level: "manual-only",
    label: "Manual only",
    description: "Humans perform the work directly. No agent execution is authorized.",
  },
  {
    level: "human-approved",
    label: "Human approved",
    description: "Agents may assist only after a human approval checkpoint is recorded.",
  },
  {
    level: "governed-automation",
    label: "Governed automation",
    description: "Execution may proceed under an external governance boundary once approved for that lane.",
  },
  {
    level: "blocked",
    label: "Blocked",
    description: "No execution is allowed until policy or review constraints are cleared.",
  },
] as const;
```

- [ ] **Step 2: Create `src/lib/marketops/permissions.ts` with coarse future-facing permission names**

```ts
export const marketOpsPermissions = [
  "initiatives.view",
  "mediums.view",
  "campaigns.view",
  "campaigns.edit",
  "content.view",
  "content.edit",
  "automation.approve",
  "agents.view",
  "alerts.resolve",
  "integrations.manage",
  "receipts.view",
] as const;

export type MarketOpsPermission = (typeof marketOpsPermissions)[number];

export type PermissionGroup = {
  group: "portfolio" | "campaigns" | "content" | "automation" | "operations" | "integrations";
  permissions: readonly MarketOpsPermission[];
};

export const permissionGroups: readonly PermissionGroup[] = [
  {
    group: "portfolio",
    permissions: ["initiatives.view", "mediums.view"],
  },
  {
    group: "campaigns",
    permissions: ["campaigns.view", "campaigns.edit"],
  },
  {
    group: "content",
    permissions: ["content.view", "content.edit"],
  },
  {
    group: "automation",
    permissions: ["automation.approve", "agents.view"],
  },
  {
    group: "operations",
    permissions: ["alerts.resolve", "receipts.view"],
  },
  {
    group: "integrations",
    permissions: ["integrations.manage"],
  },
] as const;
```

- [ ] **Step 3: Run typecheck to verify both new contract files compile and remain passive**

Run: `npm run typecheck`
Expected: PASS with no runtime-policy or missing-import errors

- [ ] **Step 4: Commit the automation and permission files**

```bash
git add src/lib/marketops/automation-levels.ts src/lib/marketops/permissions.ts
git commit -m "feat: add marketops automation and permission contracts"
```

### Task 3: Add Canonical Entity Contracts

**Files:**
- Create: `src/lib/marketops/entities.ts`
- Verify: `src/lib/marketops/status.ts`
- Verify: `src/lib/marketops/automation-levels.ts`

- [ ] **Step 1: Create `src/lib/marketops/entities.ts` with route-facing canonical entity types**

```ts
import type { AutomationLevel } from "./automation-levels";
import type {
  AgentCapability,
  AlertSeverity,
  ApprovalRequirement,
  InitiativeStatus,
  IntegrationStatus,
  MediumCategory,
  MediumSurface,
  ReceiptKind,
  RiskLevel,
} from "./status";

export type ApprovalDecision = "pending" | "approved" | "rejected" | "changes-requested";

export type Initiative = {
  id: string;
  slug: string;
  name: string;
  summary?: string;
  status: InitiativeStatus;
  riskLevel: RiskLevel;
  campaignIds: string[];
  mediumIds: string[];
  personaIds: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type Medium = {
  id: string;
  slug: string;
  name: string;
  category: MediumCategory;
  surface: MediumSurface;
  initiativeIds: string[];
  campaignIds: string[];
  contentAssetIds: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type Campaign = {
  id: string;
  slug: string;
  name: string;
  initiativeId: string;
  mediumIds: string[];
  contentAssetIds: string[];
  primaryPersonaId?: string;
  automationPolicyId: string;
  latestApprovalStateId?: string;
  latestReceiptId?: string;
  objective: string;
  riskLevel: RiskLevel;
  createdAt?: string;
  updatedAt?: string;
};

export type ContentAsset = {
  id: string;
  slug: string;
  name: string;
  mediumId: string;
  campaignId?: string;
  ownerAgentId?: string;
  formatLabel: string;
  latestReceiptId?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Persona = {
  id: string;
  slug: string;
  displayName: string;
  roleLabel: string;
  needs: string[];
  constraints: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type Agent = {
  id: string;
  slug: string;
  displayName: string;
  capabilitySet: AgentCapability[];
  approvalRequirement: ApprovalRequirement;
  automationLevel: AutomationLevel;
  riskLevel: RiskLevel;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type OperatorAlert = {
  id: string;
  slug: string;
  title: string;
  severity: AlertSeverity;
  message: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Integration = {
  id: string;
  slug: string;
  name: string;
  status: IntegrationStatus;
  categoryLabel: string;
  lastReceiptId?: string;
  approvalRequirement: ApprovalRequirement;
  createdAt?: string;
  updatedAt?: string;
};

export type Receipt = {
  id: string;
  slug: string;
  name: string;
  kind: ReceiptKind;
  subjectEntityId: string;
  subjectEntityType: string;
  summary: string;
  verificationState: "recorded" | "verified" | "disputed";
  createdAt?: string;
  updatedAt?: string;
};

export type AutomationPolicy = {
  id: string;
  slug: string;
  name: string;
  automationLevel: AutomationLevel;
  approvalRequirement: ApprovalRequirement;
  allowedCapabilities: AgentCapability[];
  escalationLabel?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ApprovalState = {
  id: string;
  slug: string;
  name: string;
  decision: ApprovalDecision;
  requestedById: string;
  requestedByDisplayName?: string;
  reviewedById?: string;
  reviewedByDisplayName?: string;
  notes?: string;
  decidedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};
```

- [ ] **Step 2: Run typecheck to verify the canonical entities import cleanly from the status and automation modules**

Run: `npm run typecheck`
Expected: PASS with no circular-import or naming errors

- [ ] **Step 3: Re-read `src/lib/marketops/entities.ts` and confirm the identifier conventions are intact**

Check for all of the following before moving on:
- every route-facing entity has `id`, `slug`, and `name` or `displayName`
- every `*Id` field contains an opaque identifier contract, not a slug or human-readable name
- timestamps use optional ISO-8601 string fields such as `createdAt` and `updatedAt`

- [ ] **Step 4: Commit the entity contract file**

```bash
git add src/lib/marketops/entities.ts
git commit -m "feat: add marketops entity contracts"
```

### Task 4: Add Fixture-Only Sample Data and the Mechanical Barrel Export

**Files:**
- Create: `src/lib/marketops/sample-data.ts`
- Create: `src/lib/marketops/index.ts`
- Verify: `src/lib/marketops/entities.ts`
- Verify: `src/lib/marketops/status.ts`
- Verify: `src/lib/marketops/automation-levels.ts`

- [ ] **Step 1: Create `src/lib/marketops/sample-data.ts` with a fixture-only warning and one canonical example per core seam**

```ts
/**
 * Fixture-only contract examples for MarketOps foundation work.
 * Do not wire these objects into production behavior, existing routes, or automation
 * without a later integration PR that explicitly migrates runtime consumers.
 */

import type {
  Agent,
  ApprovalState,
  AutomationPolicy,
  Campaign,
  ContentAsset,
  Initiative,
  Integration,
  Medium,
  OperatorAlert,
  Persona,
  Receipt,
} from "./entities";

export const sampleInitiative: Initiative = {
  id: "init_keon_marketops",
  slug: "keon-marketops-dogfood",
  name: "Keon MarketOps Dogfood",
  summary: "Internal proof loop for governed marketing operations.",
  status: "active",
  riskLevel: "high",
  campaignIds: ["camp_dogfood_receipts"],
  mediumIds: ["med_ops_dashboard"],
  personaIds: ["persona_operator"],
  createdAt: "2026-05-25T00:00:00Z",
  updatedAt: "2026-05-25T00:00:00Z",
};

export const sampleMedium: Medium = {
  id: "med_ops_dashboard",
  slug: "ops-dashboard",
  name: "Ops Dashboard",
  category: "owned",
  surface: "internal-tool",
  initiativeIds: ["init_keon_marketops"],
  campaignIds: ["camp_dogfood_receipts"],
  contentAssetIds: ["asset_receipt_overview"],
  createdAt: "2026-05-25T00:00:00Z",
  updatedAt: "2026-05-25T00:00:00Z",
};

export const sampleCampaign: Campaign = {
  id: "camp_dogfood_receipts",
  slug: "dogfood-receipt-loop",
  name: "Dogfood Receipt Loop",
  initiativeId: "init_keon_marketops",
  mediumIds: ["med_ops_dashboard"],
  contentAssetIds: ["asset_receipt_overview"],
  primaryPersonaId: "persona_operator",
  automationPolicyId: "policy_governed_execution",
  latestApprovalStateId: "approval_receipt_loop",
  latestReceiptId: "receipt_execution_proof",
  objective: "Prove proposal, approval, execution, and receipt continuity.",
  riskLevel: "high",
  createdAt: "2026-05-25T00:00:00Z",
  updatedAt: "2026-05-25T00:00:00Z",
};

export const sampleContentAsset: ContentAsset = {
  id: "asset_receipt_overview",
  slug: "receipt-overview",
  name: "Receipt Overview",
  mediumId: "med_ops_dashboard",
  campaignId: "camp_dogfood_receipts",
  ownerAgentId: "agent_operator_assistant",
  formatLabel: "dashboard panel",
  latestReceiptId: "receipt_execution_proof",
  createdAt: "2026-05-25T00:00:00Z",
  updatedAt: "2026-05-25T00:00:00Z",
};

export const samplePersona: Persona = {
  id: "persona_operator",
  slug: "operator",
  displayName: "Operator",
  roleLabel: "Human approver",
  needs: ["reviewability", "clear execution state", "receipt continuity"],
  constraints: ["must approve high-risk execution", "must avoid claim drift"],
  createdAt: "2026-05-25T00:00:00Z",
  updatedAt: "2026-05-25T00:00:00Z",
};

export const sampleAgent: Agent = {
  id: "agent_operator_assistant",
  slug: "operator-assistant",
  displayName: "Operator Assistant",
  capabilitySet: ["propose-offer", "prepare-campaign", "generate-report"],
  approvalRequirement: "human-review",
  automationLevel: "human-approved",
  riskLevel: "medium",
  isActive: true,
  createdAt: "2026-05-25T00:00:00Z",
  updatedAt: "2026-05-25T00:00:00Z",
};

export const sampleAutomationPolicy: AutomationPolicy = {
  id: "policy_governed_execution",
  slug: "governed-execution",
  name: "Governed Execution",
  automationLevel: "governed-automation",
  approvalRequirement: "governed-approval",
  allowedCapabilities: ["prepare-campaign", "publish-asset", "generate-report"],
  escalationLabel: "Escalate unresolved policy conflicts to a human operator.",
  createdAt: "2026-05-25T00:00:00Z",
  updatedAt: "2026-05-25T00:00:00Z",
};

export const sampleApprovalState: ApprovalState = {
  id: "approval_receipt_loop",
  slug: "receipt-loop-approval",
  name: "Receipt Loop Approval",
  decision: "approved",
  requestedById: "agent_operator_assistant",
  requestedByDisplayName: "Operator Assistant",
  reviewedById: "user_operator",
  reviewedByDisplayName: "Operator",
  notes: "Approved for governed execution after review.",
  decidedAt: "2026-05-25T00:00:00Z",
  createdAt: "2026-05-25T00:00:00Z",
  updatedAt: "2026-05-25T00:00:00Z",
};

export const sampleReceipt: Receipt = {
  id: "receipt_execution_proof",
  slug: "execution-proof",
  name: "Execution Proof",
  kind: "execution",
  subjectEntityId: "camp_dogfood_receipts",
  subjectEntityType: "Campaign",
  summary: "Agent execution completed and a reviewable receipt was recorded.",
  verificationState: "verified",
  createdAt: "2026-05-25T00:00:00Z",
  updatedAt: "2026-05-25T00:00:00Z",
};

export const sampleOperatorAlert: OperatorAlert = {
  id: "alert_claim_review",
  slug: "claim-review",
  title: "Claim review required",
  severity: "warning",
  message: "A high-risk campaign asset still needs final human review.",
  relatedEntityId: "camp_dogfood_receipts",
  relatedEntityType: "Campaign",
  createdAt: "2026-05-25T00:00:00Z",
  updatedAt: "2026-05-25T00:00:00Z",
};

export const sampleIntegration: Integration = {
  id: "integration_keon",
  slug: "keon",
  name: "Keon",
  status: "planned",
  categoryLabel: "governance",
  lastReceiptId: "receipt_execution_proof",
  approvalRequirement: "governed-approval",
  createdAt: "2026-05-25T00:00:00Z",
  updatedAt: "2026-05-25T00:00:00Z",
};

export const marketOpsContractFixtures = {
  initiative: sampleInitiative,
  medium: sampleMedium,
  campaign: sampleCampaign,
  contentAsset: sampleContentAsset,
  persona: samplePersona,
  agent: sampleAgent,
  automationPolicy: sampleAutomationPolicy,
  approvalState: sampleApprovalState,
  receipt: sampleReceipt,
  operatorAlert: sampleOperatorAlert,
  integration: sampleIntegration,
} as const;
```

- [ ] **Step 2: Create `src/lib/marketops/index.ts` as a mechanical barrel export only**

```ts
export * from "./automation-levels";
export * from "./entities";
export * from "./permissions";
export * from "./status";
```

- [ ] **Step 3: Run typecheck to confirm the barrel export resolves every canonical contract from `src/lib/marketops`**

Run: `npm run typecheck`
Expected: PASS with no missing export or duplicate-name errors

- [ ] **Step 4: Commit the fixture-only sample data and barrel export**

```bash
git add src/lib/marketops/sample-data.ts src/lib/marketops/index.ts
git commit -m "feat: add marketops canonical exports and fixtures"
```

### Task 5: Add the Operating Model Documentation

**Files:**
- Create: `docs/marketops/OPERATING-MODEL.md`
- Verify: `docs/superpowers/specs/2026-05-25-marketops-operating-model-foundation-design.md`

- [ ] **Step 1: Create `docs/marketops/OPERATING-MODEL.md` with the dogfood loop, entity roles, and receipt boundaries**

```md
# MarketOps Operating Model

## Core Loop

MarketOps manages Keon.
Keon governs MarketOps automation.
MarketOps produces receipts proving the ecosystem works.
Collective proposes dream offers.
Humans approve.
Agents execute.
Receipts prove what happened.

## What This Means

MarketOps is not framed here as generic marketing software. It is the first real dogfood product for the Keon ecosystem. The product exists to make the operating loop visible, reviewable, and eventually governable.

PR 0 does not implement live automation or Keon connectivity. It defines the contract layer and the language later lanes will use when they build those surfaces.

## Operating Sequence

1. A proposal is created for an initiative, campaign, asset, or integration action.
2. A human approval checkpoint is recorded when the lane requires review.
3. An agent may execute within the bounds described by an automation policy.
4. MarketOps records a receipt describing what happened.
5. Operators use the receipt to verify the decision trail and execution outcome.

## Entity Roles

- `Initiative`: the portfolio-level operating unit
- `Medium`: the channel or surface carrying work
- `Campaign`: the execution lane tying an initiative to one or more mediums
- `ContentAsset`: the concrete artifact prepared or published through a medium
- `Persona`: the target or operator context that shapes the work
- `Agent`: the bounded execution actor
- `OperatorAlert`: the human-facing warning or escalation surface
- `Integration`: the external-system seam
- `Receipt`: the reviewable proof record
- `AutomationPolicy`: the contract defining how much automation is allowed
- `ApprovalState`: the recorded review decision

## What Receipts Prove

Receipts prove that a specific step was proposed, approved, executed, recorded, or verified according to the contract used by that lane.

Receipts do not prove:

- that a claim is universally true
- that all future executions are safe
- that an external integration is correct merely because it exists in configuration

They prove what happened in a specific bounded flow.

## Why Approvals and Automation Levels Exist

Approvals exist because not every marketing or integration action should execute autonomously.

Automation levels exist so the product can distinguish:

- work humans do directly
- work agents assist with after approval
- work that may later run under a governance boundary
- work that is blocked until review or policy conditions are cleared

## PR 0 Boundary

This foundation PR is contract-only:

- no runtime migration
- no live integrations
- no policy engine
- no execution engine
- no database coupling

Integration work belongs in later explicit PRs after this contract layer lands.
```

- [ ] **Step 2: Re-read the document and confirm the tone stays operational instead of promotional**

Check for all of the following:
- the Keon relationship is described without pretending the runtime integration already exists
- receipt claims are bounded and precise
- PR 0 boundaries are explicit and conservative

- [ ] **Step 3: Commit the operating-model document**

```bash
git add docs/marketops/OPERATING-MODEL.md
git commit -m "docs: add marketops operating model"
```

### Task 6: Add the Parallel-Lane Rules

**Files:**
- Create: `docs/marketops/PARALLEL-LANES.md`
- Verify: `src/lib/marketops/index.ts`
- Verify: `docs/superpowers/specs/2026-05-25-marketops-operating-model-foundation-design.md`

- [ ] **Step 1: Create `docs/marketops/PARALLEL-LANES.md` with the merge-safety rules and canonical import guidance**

```md
# MarketOps Parallel Lanes

## Core Rule

No agent platform should depend on another platform's unmerged work.

If a lane needs another lane's work, it is not parallel-ready. It must become one of:

- a later integration PR
- a shared contract or spec PR first
- a stubbed interface
- a fixture-backed placeholder

## What PR 0 Provides

PR 0 creates the shared MarketOps contract layer and docs only.

It does not:

- refactor `src/lib/initiatives.ts`
- refactor `src/lib/campaigns.ts`
- migrate existing models
- change existing `/initiatives` behavior
- change existing `/campaigns` behavior
- add live integrations
- add database or schema coupling
- add policy evaluation or execution gating

The new MarketOps `Campaign` contract is future-canonical. The existing campaign fixtures remain unchanged until a later integration PR migrates runtime consumers onto the shared contract layer.

## Canonical Imports For Feature Lanes

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

Import from:

`src/lib/marketops`

Feature lanes may create local UI view models only when necessary, but those view models must reference or map back to the canonical contract types.

## Downstream-Agent Best Practice

Each downstream agent should first inspect:

```bash
ls src/lib/marketops
sed -n '1,220p' src/lib/marketops/entities.ts
sed -n '1,220p' src/lib/marketops/status.ts
sed -n '1,220p' src/lib/marketops/automation-levels.ts
sed -n '1,220p' docs/marketops/PARALLEL-LANES.md
```

Do not rely on pasted type names alone. Inspect `src/lib/marketops` and `docs/marketops/PARALLEL-LANES.md` on latest `main`, then use the canonical exported contracts.

If a needed field or type is missing, do not silently invent a conflicting duplicate. Create a lane-local view model or report the contract gap to the orchestrator.

## Future Integration PR

After PR 0 lands and dependent feature lanes confirm import expectations, create a follow-up integration PR that:

- migrates existing initiative models onto the shared MarketOps contracts
- migrates existing campaign models onto the shared MarketOps contracts
- updates runtime consumers in small, explicit slices

Until then, existing fixtures and current route behavior remain unchanged.
```

- [ ] **Step 2: Verify the documentation references `src/lib/marketops` as the canonical import seam**

Check for all of the following:
- the import guidance points to `src/lib/marketops`, not file-by-file ad hoc imports
- the document says the existing campaign fixtures remain unchanged until a later integration PR
- the document does not instruct downstream lanes to change current runtime pages as part of PR 0

- [ ] **Step 3: Commit the parallel-lane document**

```bash
git add docs/marketops/PARALLEL-LANES.md
git commit -m "docs: add marketops parallel lane guidance"
```

### Task 7: Run Final Verification and Record the Narrow-Scope Outcome

**Files:**
- Verify: `src/lib/marketops/status.ts`
- Verify: `src/lib/marketops/automation-levels.ts`
- Verify: `src/lib/marketops/permissions.ts`
- Verify: `src/lib/marketops/entities.ts`
- Verify: `src/lib/marketops/sample-data.ts`
- Verify: `src/lib/marketops/index.ts`
- Verify: `docs/marketops/OPERATING-MODEL.md`
- Verify: `docs/marketops/PARALLEL-LANES.md`
- Verify unchanged: `src/lib/initiatives.ts`
- Verify unchanged: `src/lib/campaigns.ts`

- [ ] **Step 1: Run the required repo validations**

Run: `npm run typecheck`
Expected: PASS

Run: `npm run build`
Expected: PASS

Run: `git diff --check`
Expected: no output

- [ ] **Step 2: Confirm the PR stayed strictly additive and did not touch existing initiative or campaign runtime files**

Run: `git diff --name-only -- src/lib/initiatives.ts src/lib/campaigns.ts src/app/initiatives src/app/campaigns src/components/app-nav.tsx`
Expected: no output

- [ ] **Step 3: Capture the final worktree status for the implementation report**

Run: `git status -sb`
Expected: current branch plus the new `src/lib/marketops/*` and `docs/marketops/*` files only

- [ ] **Step 4: Prepare the final implementation report**

Include all of the following:
- changed files
- validation commands run
- validation results
- explicit statement that existing initiative, campaign, route, and runtime behavior were not changed
- current worktree status

- [ ] **Step 5: Commit the finished foundation lane**

```bash
git add src/lib/marketops docs/marketops
git commit -m "feat: add marketops operating model foundation"
```
