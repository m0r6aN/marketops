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
  "discover-customers",
  "plan-outreach",
  "draft-content",
  "publish-asset",
  "sync-integration",
  "generate-report",
] as const;
export type AgentCapability = (typeof agentCapabilities)[number];

export const alertSeverities = ["info", "warning", "error", "critical"] as const;
export type AlertSeverity = (typeof alertSeverities)[number];
