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

export type ApprovalDecision =
  | "pending"
  | "approved"
  | "rejected"
  | "changes-requested";

type CanonicalEntityType =
  | "Initiative"
  | "Medium"
  | "Campaign"
  | "ContentAsset"
  | "Persona"
  | "Agent"
  | "OperatorAlert"
  | "Integration"
  | "Receipt"
  | "AutomationPolicy"
  | "ApprovalState";

type SubjectEntityType = Exclude<
  CanonicalEntityType,
  "Receipt" | "ApprovalState"
>;

type IsoTimestamp = string;

type TimestampFields = {
  createdAt?: IsoTimestamp;
  updatedAt?: IsoTimestamp;
};

type EntityReference =
  | {
      relatedEntityId: string;
      relatedEntityType: SubjectEntityType;
    }
  | {
      relatedEntityId?: never;
      relatedEntityType?: never;
    };

export type Initiative = TimestampFields & {
  id: string;
  slug: string;
  name: string;
  summary?: string;
  status: InitiativeStatus;
  riskLevel: RiskLevel;
  campaignIds: string[];
  mediumIds: string[];
  personaIds: string[];
};

export type Medium = TimestampFields & {
  id: string;
  slug: string;
  name: string;
  category: MediumCategory;
  surface: MediumSurface;
  initiativeIds: string[];
  campaignIds: string[];
  contentAssetIds: string[];
};

export type Campaign = TimestampFields & {
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
};

export type ContentAsset = TimestampFields & {
  id: string;
  slug: string;
  name: string;
  mediumId: string;
  campaignId?: string;
  ownerAgentId?: string;
  formatLabel: string;
  latestReceiptId?: string;
};

export type Persona = TimestampFields & {
  id: string;
  slug: string;
  displayName: string;
  roleLabel: string;
  needs: string[];
  constraints: string[];
};

export type Agent = TimestampFields & {
  id: string;
  slug: string;
  displayName: string;
  capabilitySet: AgentCapability[];
  approvalRequirement: ApprovalRequirement;
  automationLevel: AutomationLevel;
  riskLevel: RiskLevel;
  isActive: boolean;
};

export type OperatorAlert = TimestampFields &
  EntityReference & {
  id: string;
  slug: string;
  name: string;
  severity: AlertSeverity;
  message: string;
};

export type Integration = TimestampFields & {
  id: string;
  slug: string;
  name: string;
  status: IntegrationStatus;
  categoryLabel: string;
  latestReceiptId?: string;
  approvalRequirement: ApprovalRequirement;
};

export type Receipt = TimestampFields & {
  id: string;
  slug: string;
  name: string;
  kind: ReceiptKind;
  subjectEntityId: string;
  subjectEntityType: SubjectEntityType;
  summary: string;
  verificationState: "recorded" | "verified" | "disputed";
};

export type AutomationPolicy = TimestampFields & {
  id: string;
  slug: string;
  name: string;
  automationLevel: AutomationLevel;
  approvalRequirement: ApprovalRequirement;
  allowedCapabilities: AgentCapability[];
  escalationLabel?: string;
};

type ApprovalStateBase = TimestampFields & {
  id: string;
  slug: string;
  name: string;
  subjectEntityId: string;
  subjectEntityType: SubjectEntityType;
  requestedById: string;
  requestedByDisplayName?: string;
  notes?: string;
};

type PendingApprovalState = ApprovalStateBase & {
  decision: Extract<ApprovalDecision, "pending">;
  reviewedById?: never;
  reviewedByDisplayName?: never;
  decidedAt?: never;
};

type ReviewedApprovalState = ApprovalStateBase & {
  decision: Exclude<ApprovalDecision, "pending">;
  reviewedById: string;
  reviewedByDisplayName?: string;
  decidedAt: IsoTimestamp;
};

export type ApprovalState = PendingApprovalState | ReviewedApprovalState;
