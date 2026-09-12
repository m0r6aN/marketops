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

// ---------------------------------------------------------------------------
// Private-beta / GTM contracts (w0-contracts-beta, additive only).
// JSON-schema mirrors live in contracts/*.json; fixtures in
// tests/contracts/fixtures/*.json. Do not reshape existing entities here.
// ---------------------------------------------------------------------------

export type BetaStatus = "invited" | "active" | "suspended" | "graduated";

export type BetaTenant = TimestampFields & {
  /**
   * Canonical tenant key. Every tenant-scoped row, receipt, and proof
   * artifact carries this value; cross-tenant access with a mismatched
   * tenantId must be denied with a receipt.
   */
  tenantId: string;
  displayName: string;
  betaStatus: BetaStatus;
  /**
   * True only when this tenant's name, data, and outcomes may appear in
   * public proof or marketing. False (default for beta) keeps the tenant
   * private; public claims about a non-public_safe tenant are forbidden.
   */
  public_safe: boolean;
  createdAtUtc: IsoTimestamp;
};

export type EntitlementPlan = "beta" | "pilot";

export type EntitlementStatus = "active" | "lapsed" | "cancelled";

export type Entitlement = TimestampFields & {
  /**
   * Canonical tenant key. Entitlements are always evaluated for the
   * requesting tenantId; a lapsed or cancelled entitlement gates beta
   * features off.
   */
  tenantId: string;
  plan: EntitlementPlan;
  features: string[];
  status: EntitlementStatus;
  expiresAtUtc?: IsoTimestamp | null;
  updatedAtUtc: IsoTimestamp;
};

export type ClaimVerdict = "safe" | "needs-proof" | "blocked";

// ---------------------------------------------------------------------------
// Billing webhook contract types (w1-pricing-entitlement-spec, additive
// only). JSON-schema mirror lives in contracts/BillingWebhook.json;
// fixtures in tests/contracts/fixtures/billing-webhooks.json. Spec/types
// only: no Stripe SDK, no network calls, no charge paths.
// ---------------------------------------------------------------------------

export type BillingWebhookEventType =
  | "checkout.session.completed"
  | "customer.subscription.updated"
  | "customer.subscription.deleted"
  | "invoice.payment_failed";

export type BillingWebhookEvent = {
  /**
   * Stripe event id (evt_...). Unique idempotency key: consumers must
   * deduplicate on eventId so replays never double-apply a transition.
   */
  eventId: string;
  type: BillingWebhookEventType;
  /** Event creation timestamp in UTC (ISO-8601). */
  created: IsoTimestamp;
  /**
   * Canonical tenant key mapped from the Stripe object. Entitlements are
   * always evaluated for this tenantId.
   */
  tenantId: string;
  /** Minimal event payload; consumers tolerate unknown fields. */
  data: Record<string, unknown>;
};

export type ClaimParaphrase = {
  text: string;
  verdict: ClaimVerdict;
};

export type ClaimEval = TimestampFields & {
  claimId: string;
  claimText: string;
  /** Canonical tenant key when evaluated in tenant scope; null for harness evals. */
  tenantId?: string | null;
  paraphrases: ClaimParaphrase[];
  verdict: ClaimVerdict;
  reasons?: string[];
  evaluatedAtUtc: IsoTimestamp;
};

export type ConsentBasis = "opt-in" | "legitimate-interest" | "none";

export type ComplianceVerdict = "pass" | "blocked";

export type ComplianceCheck = TimestampFields & {
  /**
   * Canonical tenant key. Suppression lists are evaluated in this tenant's
   * scope; cross-tenant suppression state must never leak.
   */
  tenantId: string;
  campaignId?: string | null;
  /**
   * Lawful basis for contacting the recipients. 'none' (or missing consent
   * evidence) forces verdict 'blocked' with a reason; send adapters must
   * never execute on a blocked check.
   */
  consentBasis: ConsentBasis;
  suppressionChecked: boolean;
  unsubscribeLinkPresent: boolean;
  /** SPF/DKIM/DMARC verifier outcome for the sending domain. False blocks. */
  senderAuthPass: boolean;
  physicalAddressPresent: boolean;
  verdict: ComplianceVerdict;
  blockedReasons?: string[];
  checkedAtUtc: IsoTimestamp;
};

export type ProofpackRunMode = "dry_run" | "prod";

export type ProofpackRun = {
  runId: string;
  mode: ProofpackRunMode;
  path: string;
  sha256: string;
};

export type ProofpackManifest = TimestampFields & {
  packId: string;
  /**
   * Canonical tenant key. A proofpack seals evidence for exactly one
   * tenant; multi-tenant packs are forbidden.
   */
  tenantId: string;
  createdAtUtc: IsoTimestamp;
  runs: ProofpackRun[];
  packSha256: string;
};
