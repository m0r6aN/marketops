// ─────────────────────────────────────────────────────────────────────────────
// Library Canon Foundry — TypeScript types
// ─────────────────────────────────────────────────────────────────────────────

// ── Processing configuration ─────────────────────────────────────────────────

/** The four extraction modes the user can select when starting an import. */
export type ProcessingMode = "canon" | "marketing" | "internal" | "trash";

/** Which model tier to use for processing. */
export type ModelStrategy = "auto" | "sonnet-only";

/** Which LLM provider the import pipeline should use. */
export type LibraryLlmProvider = "anthropic" | "ollama" | "blackbox";

// ── Import batches ────────────────────────────────────────────────────────────

export type ImportBatchStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export type ImportBatch = {
  id: string;
  initiativeSlug: string | null;
  selectedModes: ProcessingMode[];
  modelStrategy: ModelStrategy;
  status: ImportBatchStatus;
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  entriesExtracted: number;
  trashCandidates: number;
  filesMovedToTrash: number;
  conflictsDetected: number;
  summary: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

// ── Source documents ──────────────────────────────────────────────────────────

export type ParserStatus = "pending" | "processed" | "failed";

export type DocumentProcessingStatus =
  | "pending"
  | "processing"
  | "processed"
  | "failed";

export type ImportFileMetadata = {
  name: string;
  size: number;
  lastModified: number;
  relativePath: string | null;
};

export type SourceDocument = {
  id: string;
  importBatchId: string;
  originalFilename: string;
  clientRelativePath: string | null;
  mimeType: string | null;
  fileSize: number | null;
  contentHash: string | null;
  rawText: string | null;
  parserStatus: ParserStatus;
  processingStatus: DocumentProcessingStatus;
  usefulnessScore: number;
  trashRecommendation: boolean;
  trashReason: string | null;
  movedToTrashAt: string | null;
  restoredAt: string | null;
  errorMessage: string | null;
  ingestedAt: string;
  createdAt: string;
};

// ── Library entries ───────────────────────────────────────────────────────────

export type EntryType = "canon" | "marketing_nugget" | "internal_note";

export type EntryVisibility = "public" | "internal" | "private";

// Per-type status sets (spec §6)
export type CanonStatus =
  | "candidate"
  | "approved"
  | "locked"
  | "conflicted"
  | "deprecated"
  | "rejected";

export type MarketingNuggetStatus =
  | "candidate"
  | "approved"
  | "needs_rewrite"
  | "used"
  | "rejected"
  | "archived";

export type InternalNoteStatus =
  | "candidate"
  | "saved"
  | "important"
  | "needs_review"
  | "outdated"
  | "archived";

export type EntryStatus = CanonStatus | MarketingNuggetStatus | InternalNoteStatus;

export type ConflictStatus = "conflicted" | "resolved" | null;

/** Base library entry — all extracted knowledge shares these fields. */
export type LibraryEntry = {
  id: string;
  sourceDocumentId: string;
  importBatchId: string;
  initiativeSlug: string | null;
  entryType: EntryType;
  title: string;
  content: string;
  summary: string | null;
  visibility: EntryVisibility;
  status: EntryStatus;
  tags: string[];
  confidenceScore: number;
  memoryValueScore: number;
  publicSafe: boolean;
  sensitive: boolean;
  sourceQuote: string | null;
  sourceLocation: string | null;
  modelUsed: string | null;

  // Canon-specific (null for other types)
  canonCategory: string | null;
  canonicalStatement: string | null;
  locked: boolean;
  conflictStatus: ConflictStatus;
  publicAutomationAllowed: boolean;

  // Marketing-nugget-specific (null for other types)
  copyText: string | null;
  suggestedChannel: string | null;
  suggestedUse: string | null;
  emotionalAngle: string | null;
  audience: string | null;
  approvedForAutomation: boolean;

  // Docs-as-marketing-review fields (populated when entry was created by the
  // docs-as-marketing-review skill; null on legacy / non-review nuggets).
  sourceSection: string | null;
  sourceExcerpt: string | null;
  marketingAngle: string | null;
  suggestedRewrite: string | null;
  useFor: MarketingUseFor[] | null;
  reviewAudience: MarketingAudience[] | null;
  funnelStage: MarketingFunnelStage | null;
  contentType: MarketingContentType[] | null;
  reviewConfidence: MarketingReviewConfidence | null;
  proofStrength: MarketingProofStrength | null;
  claimRisk: MarketingClaimRisk | null;
  linkBackRequired: boolean;
  reviewSummaryId: string | null;
  rubricVersion: string | null;

  // Internal-note-specific (null for other types)
  internalCategory: string | null;
  sensitivityLevel: string | null;
  whyItMatters: string | null;
  reviewPriority: string | null;

  // Audit
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Narrowed view for canon entries. */
export type CanonEntry = LibraryEntry & {
  entryType: "canon";
  canonCategory: string;
  canonicalStatement: string;
  status: CanonStatus;
};

/** Narrowed view for marketing nuggets. */
export type MarketingNugget = LibraryEntry & {
  entryType: "marketing_nugget";
  copyText: string;
  status: MarketingNuggetStatus;
};

/** Narrowed view for internal notes. */
export type InternalNote = LibraryEntry & {
  entryType: "internal_note";
  status: InternalNoteStatus;
};

// ── Docs-as-marketing review (rubric: docs-as-marketing.v1) ──────────────────

export const MARKETING_REVIEW_RUBRIC_VERSION = "docs-as-marketing.v1" as const;

export type MarketingUseFor =
  | "Website" | "Landing Page" | "Blog" | "SEO"
  | "Social Media" | "LinkedIn" | "X / Twitter"
  | "Email" | "Newsletter"
  | "Sales Deck" | "Investor Deck"
  | "Webinar" | "Demo Script" | "Product Tour"
  | "FAQ" | "Knowledge Hub" | "Case Study"
  | "One-Pager" | "Whitepaper" | "Press / Launch"
  | "Documentation Link-Back";

export type MarketingAudience =
  | "Developer" | "Platform Team" | "Security Team" | "Compliance Team"
  | "Executive" | "Founder" | "Buyer" | "Operator"
  | "Auditor" | "Partner" | "Investor";

export type MarketingFunnelStage =
  | "Awareness" | "Education" | "Consideration" | "Conversion"
  | "Activation" | "Retention" | "Expansion"
  | "Trust Building" | "Objection Handling";

export type MarketingContentType =
  | "Problem Statement" | "Product Positioning" | "Feature" | "Benefit"
  | "Proof Point" | "Differentiator" | "Customer Outcome"
  | "Technical Explanation" | "Architecture Principle" | "Integration"
  | "Benchmark" | "FAQ" | "Glossary" | "Tutorial" | "Comparison"
  | "Objection" | "Risk Reduction"
  | "Quote Candidate" | "Hook" | "CTA Candidate";

export type MarketingReviewConfidence =
  | "Use As-Is" | "Light Rewrite" | "Heavy Rewrite"
  | "Needs Proof" | "Needs Version Check" | "Roadmap Only"
  | "Internal Only" | "Do Not Use";

export type MarketingProofStrength = "Strong" | "Medium" | "Weak" | "Unsupported";

export type MarketingClaimRisk = "Low" | "Medium" | "High";

export type MarketingAssetPriority = "High" | "Medium" | "Low";

export type MarketingAssetStatus =
  | "proposed" | "accepted" | "drafted" | "shipped" | "rejected";

/** One row per source_document scored by the docs-as-marketing-review skill. */
export type MarketingReviewSummary = {
  id: string;
  sourceDocumentId: string;
  importBatchId: string;
  overallScore: number;                       // 0–100
  bestMarketingUses: MarketingUseFor[];
  highestValueTheme: string | null;
  rubricVersion: string;
  reviewedAt: string;
  createdAt: string;
};

/** One row per risky claim flagged by the skill. */
export type MarketingRedFlag = {
  id: string;
  sourceDocumentId: string;
  reviewSummaryId: string | null;
  libraryEntryId: string | null;
  sourceExcerpt: string;
  riskLevel: MarketingClaimRisk;
  issue: string;
  saferWording: string | null;
  proofRequirement: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
};

/** One row per downstream asset the source could feed. */
export type MarketingAssetOpportunity = {
  id: string;
  sourceDocumentId: string;
  reviewSummaryId: string | null;
  assetType: string;
  theme: string;
  priority: MarketingAssetPriority;
  status: MarketingAssetStatus;
  notes: string | null;
  createdAt: string;
};

/** The full skill output, unmodified — the shape `marketing-review-writer` consumes. */
export type DocsAsMarketingReviewPayload = {
  summary: {
    best_marketing_uses: MarketingUseFor[];
    overall_score: number;
    highest_value_theme: string | null;
  };
  candidates: Array<{
    source_section: string;
    source_excerpt: string;
    marketing_angle: string;
    suggested_rewrite: string;
    use_for: MarketingUseFor[];
    audience: MarketingAudience[];
    funnel_stage: MarketingFunnelStage;
    content_type: MarketingContentType[];
    confidence: MarketingReviewConfidence;
    proof_strength: MarketingProofStrength;
    claim_risk: MarketingClaimRisk;
    link_back_required: boolean;
  }>;
  red_flags: Array<{
    source_excerpt: string;
    risk_level: MarketingClaimRisk;
    issue: string;
    safer_wording?: string | null;
    proof_requirement?: string | null;
  }>;
  asset_opportunities: Array<{
    asset_type: string;
    theme: string;
    priority: MarketingAssetPriority;
  }>;
};

/** Result of a successful persist-mode skill run. */
export type MarketingReviewPersistResult = {
  reviewSummaryId: string;
  libraryEntryIds: string[];
  redFlagIds: string[];
  assetOpportunityIds: string[];
};

// ── Conflicts ─────────────────────────────────────────────────────────────────

export type ConflictSeverity = "minor" | "major" | "critical";

export type ConflictResolution =
  | "keep_existing"
  | "replace"
  | "merge"
  | "reject_new"
  | "save_historical";

export type ConflictRecord = {
  id: string;
  existingEntryId: string;
  challengerEntryId: string;
  conflictReason: string;
  severity: ConflictSeverity;
  resolution: ConflictResolution | null;
  resolvedAt: string | null;
  createdAt: string;
};

// ── Trash ─────────────────────────────────────────────────────────────────────

export type TrashRecord = {
  id: string;
  sourceDocumentId: string;
  originalFilename: string;
  reason: string;
  confidenceScore: number;
  importBatchId: string;
  movedAt: string;
  restoredAt: string | null;
  restoreAvailable: boolean;
};

// ── Request / action types ────────────────────────────────────────────────────

/** What the UI submits to POST /api/library/import */
export type ImportRequest = {
  modes: ProcessingMode[];
  modelStrategy: ModelStrategy;
  useOllama?: boolean;
  useBlackbox?: boolean;
  // files come as FormData
};

/** Actions available from the review queue. */
export type ReviewAction =
  | "approve_canon"
  | "approve_marketing"
  | "approve_internal"
  | "reject"
  | "edit"
  | "merge"
  | "flag_sensitive"
  | "trash_source";

// ── Filter types ──────────────────────────────────────────────────────────────

export type LibraryEntryFilters = {
  entryType?: EntryType;
  status?: EntryStatus;
  visibility?: EntryVisibility;
  publicSafe?: boolean;
  sensitive?: boolean;
  tags?: string[];
  initiativeSlug?: string;
  importBatchId?: string;
  sourceDocumentId?: string;
  searchQuery?: string;
  minConfidence?: number;
  minMemoryValue?: number;
};

// ── Service view types ────────────────────────────────────────────────────────

export type LibrarySectionCounts = {
  reviewQueue: number;
  canon: number;
  marketing: number;
  internal: number;
  conflicts: number;
  trash: number;
  imports: number;
  redFlags: number;              // unresolved docs-as-marketing red flags
  assetOpportunities: number;    // open (non-shipped, non-rejected) opportunities
};

export type PublicSafetyCheckResult = {
  safe: boolean;
  failedConditions: string[];
};
