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

const sampleTimestamp = "2026-05-25T00:00:00Z";
const fixtureIds = {
  initiative: "init_keon_marketops",
  medium: "med_ops_dashboard",
  campaign: "camp_dogfood_receipts",
  contentAsset: "asset_receipt_overview",
  persona: "persona_operator",
  agent: "agent_operator_assistant",
  automationPolicy: "policy_governed_execution",
  approvalState: "approval_receipt_loop",
  receipt: "receipt_execution_proof",
  operatorReviewer: "user_operator",
} as const;

export const sampleInitiative: Initiative = {
  id: fixtureIds.initiative,
  slug: "keon-marketops-dogfood",
  name: "Keon MarketOps Dogfood",
  summary: "Internal proof loop for governed marketing operations.",
  status: "active",
  riskLevel: "high",
  campaignIds: [fixtureIds.campaign],
  mediumIds: [fixtureIds.medium],
  personaIds: [fixtureIds.persona],
  createdAt: sampleTimestamp,
  updatedAt: sampleTimestamp,
};

export const sampleMedium: Medium = {
  id: fixtureIds.medium,
  slug: "ops-dashboard",
  name: "Ops Dashboard",
  category: "owned",
  surface: "internal-tool",
  initiativeIds: [fixtureIds.initiative],
  campaignIds: [fixtureIds.campaign],
  contentAssetIds: [fixtureIds.contentAsset],
  createdAt: sampleTimestamp,
  updatedAt: sampleTimestamp,
};

export const sampleCampaign: Campaign = {
  id: fixtureIds.campaign,
  slug: "dogfood-receipt-loop",
  name: "Dogfood Receipt Loop",
  initiativeId: fixtureIds.initiative,
  mediumIds: [fixtureIds.medium],
  contentAssetIds: [fixtureIds.contentAsset],
  primaryPersonaId: fixtureIds.persona,
  automationPolicyId: fixtureIds.automationPolicy,
  latestApprovalStateId: fixtureIds.approvalState,
  latestReceiptId: fixtureIds.receipt,
  objective: "Prove proposal, approval, execution, and receipt continuity.",
  riskLevel: "high",
  createdAt: sampleTimestamp,
  updatedAt: sampleTimestamp,
};

export const sampleContentAsset: ContentAsset = {
  id: fixtureIds.contentAsset,
  slug: "receipt-overview",
  name: "Receipt Overview",
  mediumId: fixtureIds.medium,
  campaignId: fixtureIds.campaign,
  ownerAgentId: fixtureIds.agent,
  formatLabel: "dashboard panel",
  latestReceiptId: fixtureIds.receipt,
  createdAt: sampleTimestamp,
  updatedAt: sampleTimestamp,
};

export const samplePersona: Persona = {
  id: fixtureIds.persona,
  slug: "operator",
  displayName: "Operator",
  roleLabel: "Human approver",
  needs: ["reviewability", "clear execution state", "receipt continuity"],
  constraints: ["must approve high-risk execution", "must avoid claim drift"],
  createdAt: sampleTimestamp,
  updatedAt: sampleTimestamp,
};

export const sampleAgent: Agent = {
  id: fixtureIds.agent,
  slug: "operator-assistant",
  displayName: "Operator Assistant",
  capabilitySet: ["propose-offer", "prepare-campaign", "generate-report"],
  approvalRequirement: "human-review",
  automationLevel: "human-approved",
  riskLevel: "medium",
  isActive: true,
  createdAt: sampleTimestamp,
  updatedAt: sampleTimestamp,
};

export const sampleAutomationPolicy: AutomationPolicy = {
  id: fixtureIds.automationPolicy,
  slug: "governed-execution",
  name: "Governed Execution",
  automationLevel: "governed-automation",
  approvalRequirement: "governed-approval",
  allowedCapabilities: ["prepare-campaign", "publish-asset", "generate-report"],
  escalationLabel: "Escalate unresolved policy conflicts to a human operator.",
  createdAt: sampleTimestamp,
  updatedAt: sampleTimestamp,
};

export const sampleApprovalState: ApprovalState = {
  id: fixtureIds.approvalState,
  slug: "receipt-loop-approval",
  name: "Receipt Loop Approval",
  subjectEntityId: fixtureIds.campaign,
  subjectEntityType: "Campaign",
  decision: "approved",
  requestedById: fixtureIds.agent,
  requestedByDisplayName: "Operator Assistant",
  reviewedById: fixtureIds.operatorReviewer,
  reviewedByDisplayName: "Operator",
  notes: "Approved for governed execution after review.",
  decidedAt: sampleTimestamp,
  createdAt: sampleTimestamp,
  updatedAt: sampleTimestamp,
};

export const sampleReceipt: Receipt = {
  id: fixtureIds.receipt,
  slug: "execution-proof",
  name: "Execution Proof",
  kind: "execution",
  subjectEntityId: fixtureIds.campaign,
  subjectEntityType: "Campaign",
  summary: "Agent execution completed and a reviewable receipt was recorded.",
  verificationState: "verified",
  createdAt: sampleTimestamp,
  updatedAt: sampleTimestamp,
};

export const sampleOperatorAlert: OperatorAlert = {
  id: "alert_claim_review",
  slug: "claim-review",
  name: "Claim review required",
  severity: "warning",
  message: "A high-risk campaign asset still needs final human review.",
  relatedEntityId: fixtureIds.campaign,
  relatedEntityType: "Campaign",
  createdAt: sampleTimestamp,
  updatedAt: sampleTimestamp,
};

export const sampleIntegration: Integration = {
  id: "integration_keon",
  slug: "keon",
  name: "Keon",
  status: "planned",
  categoryLabel: "governance",
  latestReceiptId: fixtureIds.receipt,
  approvalRequirement: "governed-approval",
  createdAt: sampleTimestamp,
  updatedAt: sampleTimestamp,
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
