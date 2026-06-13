/**
 * Library Canon Foundry — repository layer.
 *
 * Direct SQL via better-sqlite3.  No ORM.  All camelCase ↔ snake_case
 * mapping happens here so callers work with clean TypeScript types.
 */
import { db } from "@/lib/library/db";
import type {
    ConflictRecord,
    ConflictResolution,
    ConflictSeverity,
    DocumentProcessingStatus,
    EntryStatus,
    EntryType,
    EntryVisibility,
    ImportBatch,
    ImportBatchStatus,
    LibraryEntry,
    LibraryEntryFilters,
    MarketingAssetOpportunity,
    MarketingAssetPriority,
    MarketingAssetStatus,
    MarketingAudience,
    MarketingClaimRisk,
    MarketingContentType,
    MarketingFunnelStage,
    MarketingProofStrength,
    MarketingRedFlag,
    MarketingReviewConfidence,
    MarketingReviewSummary,
    MarketingUseFor,
    ParserStatus,
    SourceDocument,
    TrashRecord,
} from "@/lib/library/types";
import { randomUUID } from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Raw DB row types
// ─────────────────────────────────────────────────────────────────────────────

type RawBatchRow = {
  id: string;
  initiative_slug: string | null;
  selected_modes: string;
  model_strategy: string;
  status: string;
  total_files: number;
  processed_files: number;
  failed_files: number;
  entries_extracted: number;
  trash_candidates: number;
  files_moved_to_trash: number;
  conflicts_detected: number;
  summary: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type RawDocRow = {
  id: string;
  import_batch_id: string;
  original_filename: string;
  client_relative_path: string | null;
  mime_type: string | null;
  file_size: number | null;
  content_hash: string | null;
  raw_text: string | null;
  parser_status: string;
  processing_status: string;
  usefulness_score: number;
  trash_recommendation: number;
  trash_reason: string | null;
  moved_to_trash_at: string | null;
  restored_at: string | null;
  error_message: string | null;
  ingested_at: string;
  created_at: string;
};

type RawEntryRow = {
  id: string;
  source_document_id: string;
  import_batch_id: string;
  initiative_slug: string | null;
  entry_type: string;
  title: string;
  content: string;
  summary: string | null;
  visibility: string;
  status: string;
  tags: string;
  confidence_score: number;
  memory_value_score: number;
  public_safe: number;
  sensitive: number;
  source_quote: string | null;
  source_location: string | null;
  model_used: string | null;
  canon_category: string | null;
  canonical_statement: string | null;
  locked: number;
  conflict_status: string | null;
  public_automation_allowed: number;
  copy_text: string | null;
  suggested_channel: string | null;
  suggested_use: string | null;
  emotional_angle: string | null;
  audience: string | null;
  approved_for_automation: number;
  internal_category: string | null;
  sensitivity_level: string | null;
  why_it_matters: string | null;
  review_priority: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  // Docs-as-marketing-review columns (added by additive migrations).
  source_section: string | null;
  source_excerpt: string | null;
  marketing_angle: string | null;
  suggested_rewrite: string | null;
  use_for: string | null;            // JSON array
  review_audience: string | null;    // JSON array
  funnel_stage: string | null;
  content_type: string | null;       // JSON array
  review_confidence: string | null;
  proof_strength: string | null;
  claim_risk: string | null;
  link_back_required: number;
  review_summary_id: string | null;
  rubric_version: string | null;
};

type RawMarketingReviewSummaryRow = {
  id: string;
  source_document_id: string;
  import_batch_id: string;
  overall_score: number;
  best_marketing_uses: string;       // JSON array
  highest_value_theme: string | null;
  rubric_version: string;
  reviewed_at: string;
  created_at: string;
};

type RawMarketingRedFlagRow = {
  id: string;
  source_document_id: string;
  review_summary_id: string | null;
  library_entry_id: string | null;
  source_excerpt: string;
  risk_level: string;
  issue: string;
  safer_wording: string | null;
  proof_requirement: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
};

type RawMarketingAssetOpportunityRow = {
  id: string;
  source_document_id: string;
  review_summary_id: string | null;
  asset_type: string;
  theme: string;
  priority: string;
  status: string;
  notes: string | null;
  created_at: string;
};

type RawConflictRow = {
  id: string;
  existing_entry_id: string;
  challenger_entry_id: string;
  conflict_reason: string;
  severity: string;
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
};

type RawTrashRow = {
  id: string;
  source_document_id: string;
  original_filename: string;
  reason: string;
  confidence_score: number;
  import_batch_id: string;
  moved_at: string;
  restored_at: string | null;
  restore_available: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Row → type mappers
// ─────────────────────────────────────────────────────────────────────────────

function mapBatch(row: RawBatchRow): ImportBatch {
  return {
    id: row.id,
    initiativeSlug: row.initiative_slug,
    selectedModes: JSON.parse(row.selected_modes),
    modelStrategy: row.model_strategy as ImportBatch["modelStrategy"],
    status: row.status as ImportBatchStatus,
    totalFiles: row.total_files,
    processedFiles: row.processed_files,
    failedFiles: row.failed_files,
    entriesExtracted: row.entries_extracted,
    trashCandidates: row.trash_candidates,
    filesMovedToTrash: row.files_moved_to_trash,
    conflictsDetected: row.conflicts_detected,
    summary: row.summary,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

function mapDoc(row: RawDocRow): SourceDocument {
  return {
    id: row.id,
    importBatchId: row.import_batch_id,
    originalFilename: row.original_filename,
    clientRelativePath: row.client_relative_path,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    contentHash: row.content_hash,
    rawText: row.raw_text,
    parserStatus: row.parser_status as ParserStatus,
    processingStatus: row.processing_status as DocumentProcessingStatus,
    usefulnessScore: row.usefulness_score,
    trashRecommendation: Boolean(row.trash_recommendation),
    trashReason: row.trash_reason,
    movedToTrashAt: row.moved_to_trash_at,
    restoredAt: row.restored_at,
    errorMessage: row.error_message,
    ingestedAt: row.ingested_at,
    createdAt: row.created_at,
  };
}

function mapEntry(row: RawEntryRow): LibraryEntry {
  return {
    id: row.id,
    sourceDocumentId: row.source_document_id,
    importBatchId: row.import_batch_id,
    initiativeSlug: row.initiative_slug,
    entryType: row.entry_type as EntryType,
    title: row.title,
    content: row.content,
    summary: row.summary,
    visibility: row.visibility as EntryVisibility,
    status: row.status as EntryStatus,
    tags: JSON.parse(row.tags),
    confidenceScore: row.confidence_score,
    memoryValueScore: row.memory_value_score,
    publicSafe: Boolean(row.public_safe),
    sensitive: Boolean(row.sensitive),
    sourceQuote: row.source_quote,
    sourceLocation: row.source_location,
    modelUsed: row.model_used,
    canonCategory: row.canon_category,
    canonicalStatement: row.canonical_statement,
    locked: Boolean(row.locked),
    conflictStatus: row.conflict_status as LibraryEntry["conflictStatus"],
    publicAutomationAllowed: Boolean(row.public_automation_allowed),
    copyText: row.copy_text,
    suggestedChannel: row.suggested_channel,
    suggestedUse: row.suggested_use,
    emotionalAngle: row.emotional_angle,
    audience: row.audience,
    approvedForAutomation: Boolean(row.approved_for_automation),
    internalCategory: row.internal_category,
    sensitivityLevel: row.sensitivity_level,
    whyItMatters: row.why_it_matters,
    reviewPriority: row.review_priority,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    sourceSection: row.source_section,
    sourceExcerpt: row.source_excerpt,
    marketingAngle: row.marketing_angle,
    suggestedRewrite: row.suggested_rewrite,
    useFor: row.use_for ? (JSON.parse(row.use_for) as MarketingUseFor[]) : null,
    reviewAudience: row.review_audience
      ? (JSON.parse(row.review_audience) as MarketingAudience[])
      : null,
    funnelStage: row.funnel_stage as MarketingFunnelStage | null,
    contentType: row.content_type
      ? (JSON.parse(row.content_type) as MarketingContentType[])
      : null,
    reviewConfidence: row.review_confidence as MarketingReviewConfidence | null,
    proofStrength: row.proof_strength as MarketingProofStrength | null,
    claimRisk: row.claim_risk as MarketingClaimRisk | null,
    linkBackRequired: Boolean(row.link_back_required),
    reviewSummaryId: row.review_summary_id,
    rubricVersion: row.rubric_version,
  };
}

function mapMarketingReviewSummary(
  row: RawMarketingReviewSummaryRow
): MarketingReviewSummary {
  return {
    id: row.id,
    sourceDocumentId: row.source_document_id,
    importBatchId: row.import_batch_id,
    overallScore: row.overall_score,
    bestMarketingUses: JSON.parse(row.best_marketing_uses) as MarketingUseFor[],
    highestValueTheme: row.highest_value_theme,
    rubricVersion: row.rubric_version,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

function mapMarketingRedFlag(row: RawMarketingRedFlagRow): MarketingRedFlag {
  return {
    id: row.id,
    sourceDocumentId: row.source_document_id,
    reviewSummaryId: row.review_summary_id,
    libraryEntryId: row.library_entry_id,
    sourceExcerpt: row.source_excerpt,
    riskLevel: row.risk_level as MarketingClaimRisk,
    issue: row.issue,
    saferWording: row.safer_wording,
    proofRequirement: row.proof_requirement,
    resolvedAt: row.resolved_at,
    resolutionNote: row.resolution_note,
    createdAt: row.created_at,
  };
}

function mapMarketingAssetOpportunity(
  row: RawMarketingAssetOpportunityRow
): MarketingAssetOpportunity {
  return {
    id: row.id,
    sourceDocumentId: row.source_document_id,
    reviewSummaryId: row.review_summary_id,
    assetType: row.asset_type,
    theme: row.theme,
    priority: row.priority as MarketingAssetPriority,
    status: row.status as MarketingAssetStatus,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function mapConflict(row: RawConflictRow): ConflictRecord {
  return {
    id: row.id,
    existingEntryId: row.existing_entry_id,
    challengerEntryId: row.challenger_entry_id,
    conflictReason: row.conflict_reason,
    severity: row.severity as ConflictSeverity,
    resolution: row.resolution as ConflictResolution | null,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
  };
}

function mapTrash(row: RawTrashRow): TrashRecord {
  return {
    id: row.id,
    sourceDocumentId: row.source_document_id,
    originalFilename: row.original_filename,
    reason: row.reason,
    confidenceScore: row.confidence_score,
    importBatchId: row.import_batch_id,
    movedAt: row.moved_at,
    restoredAt: row.restored_at,
    restoreAvailable: Boolean(row.restore_available),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Import batch CRUD
// ─────────────────────────────────────────────────────────────────────────────

export function createImportBatch(data: {
  selectedModes: string[];
  modelStrategy: string;
  initiativeSlug?: string | null;
}): ImportBatch {
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO library_import_batches
      (id, initiative_slug, selected_modes, model_strategy, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `).run(
    id,
    data.initiativeSlug ?? null,
    JSON.stringify(data.selectedModes),
    data.modelStrategy,
    createdAt
  );

  return getImportBatch(id)!;
}

export function getImportBatch(id: string): ImportBatch | null {
  const row = db
    .prepare(`SELECT * FROM library_import_batches WHERE id = ?`)
    .get(id) as RawBatchRow | undefined;
  return row ? mapBatch(row) : null;
}

export function updateImportBatch(
  id: string,
  updates: Partial<{
    status: ImportBatchStatus;
    totalFiles: number;
    processedFiles: number;
    failedFiles: number;
    entriesExtracted: number;
    trashCandidates: number;
    filesMovedToTrash: number;
    conflictsDetected: number;
    summary: string;
    startedAt: string;
    completedAt: string;
  }>
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  const colMap: Record<string, string> = {
    status: "status",
    totalFiles: "total_files",
    processedFiles: "processed_files",
    failedFiles: "failed_files",
    entriesExtracted: "entries_extracted",
    trashCandidates: "trash_candidates",
    filesMovedToTrash: "files_moved_to_trash",
    conflictsDetected: "conflicts_detected",
    summary: "summary",
    startedAt: "started_at",
    completedAt: "completed_at",
  };

  for (const [key, col] of Object.entries(colMap)) {
    if (key in updates) {
      fields.push(`${col} = ?`);
      values.push(updates[key as keyof typeof updates]);
    }
  }

  if (fields.length === 0) return;
  values.push(id);
  db.prepare(
    `UPDATE library_import_batches SET ${fields.join(", ")} WHERE id = ?`
  ).run(...values);
}

export function listImportBatches(): ImportBatch[] {
  const rows = db
    .prepare(`SELECT * FROM library_import_batches ORDER BY created_at DESC`)
    .all() as RawBatchRow[];
  return rows.map(mapBatch);
}

// ─────────────────────────────────────────────────────────────────────────────
// Source document CRUD
// ─────────────────────────────────────────────────────────────────────────────

export function createSourceDocument(data: {
  importBatchId: string;
  originalFilename: string;
  clientRelativePath?: string | null;
  mimeType?: string;
  fileSize?: number;
  contentHash?: string;
}): SourceDocument {
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO library_source_documents
      (id, import_batch_id, original_filename, client_relative_path, mime_type, file_size,
       content_hash, parser_status, processing_status, ingested_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?, ?)
  `).run(
    id,
    data.importBatchId,
    data.originalFilename,
    data.clientRelativePath ?? null,
    data.mimeType ?? null,
    data.fileSize ?? null,
    data.contentHash ?? null,
    now,
    now
  );

  return getSourceDocument(id)!;
}

export function getSourceDocument(id: string): SourceDocument | null {
  const row = db
    .prepare(`SELECT * FROM library_source_documents WHERE id = ?`)
    .get(id) as RawDocRow | undefined;
  return row ? mapDoc(row) : null;
}

export function listSourceDocumentsByBatch(batchId: string): SourceDocument[] {
  const rows = db
    .prepare(
      `SELECT * FROM library_source_documents WHERE import_batch_id = ? ORDER BY created_at ASC`
    )
    .all(batchId) as RawDocRow[];
  return rows.map(mapDoc);
}

export function updateSourceDocument(
  id: string,
  updates: Partial<{
    rawText: string;
    contentHash: string;
    parserStatus: ParserStatus;
    processingStatus: DocumentProcessingStatus;
    usefulnessScore: number;
    trashRecommendation: boolean;
    trashReason: string;
    movedToTrashAt: string;
    restoredAt: string;
    errorMessage: string;
  }>
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  const colMap: Record<string, string> = {
    rawText: "raw_text",
    contentHash: "content_hash",
    parserStatus: "parser_status",
    processingStatus: "processing_status",
    usefulnessScore: "usefulness_score",
    trashRecommendation: "trash_recommendation",
    trashReason: "trash_reason",
    movedToTrashAt: "moved_to_trash_at",
    restoredAt: "restored_at",
    errorMessage: "error_message",
  };

  for (const [key, col] of Object.entries(colMap)) {
    if (key in updates) {
      fields.push(`${col} = ?`);
      const val = updates[key as keyof typeof updates];
      // Convert booleans to integers for SQLite
      values.push(typeof val === "boolean" ? (val ? 1 : 0) : val);
    }
  }

  if (fields.length === 0) return;
  values.push(id);
  db.prepare(
    `UPDATE library_source_documents SET ${fields.join(", ")} WHERE id = ?`
  ).run(...values);
}

// ─────────────────────────────────────────────────────────────────────────────
// Library entry CRUD
// ─────────────────────────────────────────────────────────────────────────────

// Review-skill fields are optional for legacy callers (e.g. processor.ts).
// They default to null when omitted.
type CreateLibraryEntryInput = Omit<
  LibraryEntry,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "sourceSection"
  | "sourceExcerpt"
  | "marketingAngle"
  | "suggestedRewrite"
  | "useFor"
  | "reviewAudience"
  | "funnelStage"
  | "contentType"
  | "reviewConfidence"
  | "proofStrength"
  | "claimRisk"
  | "linkBackRequired"
  | "reviewSummaryId"
  | "rubricVersion"
> &
  Partial<
    Pick<
      LibraryEntry,
      | "sourceSection"
      | "sourceExcerpt"
      | "marketingAngle"
      | "suggestedRewrite"
      | "useFor"
      | "reviewAudience"
      | "funnelStage"
      | "contentType"
      | "reviewConfidence"
      | "proofStrength"
      | "claimRisk"
      | "linkBackRequired"
      | "reviewSummaryId"
      | "rubricVersion"
    >
  > & { tags?: string[] };

export function createLibraryEntry(data: CreateLibraryEntryInput): LibraryEntry {
  const id = randomUUID();
  const now = new Date().toISOString();
  const tags = JSON.stringify(data.tags ?? []);

  db.prepare(`
    INSERT INTO library_entries (
      id, source_document_id, import_batch_id, initiative_slug, entry_type,
      title, content, summary, visibility, status, tags,
      confidence_score, memory_value_score, public_safe, sensitive,
      source_quote, source_location, model_used,
      canon_category, canonical_statement, locked, conflict_status, public_automation_allowed,
      copy_text, suggested_channel, suggested_use, emotional_angle, audience, approved_for_automation,
      internal_category, sensitivity_level, why_it_matters, review_priority,
      reviewed_by, reviewed_at, created_at, updated_at,
      source_section, source_excerpt, marketing_angle, suggested_rewrite,
      use_for, review_audience, funnel_stage, content_type,
      review_confidence, proof_strength, claim_risk, link_back_required,
      review_summary_id, rubric_version
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?
    )
  `).run(
    id, data.sourceDocumentId, data.importBatchId, data.initiativeSlug ?? null, data.entryType,
    data.title, data.content, data.summary ?? null, data.visibility, data.status, tags,
    data.confidenceScore, data.memoryValueScore, data.publicSafe ? 1 : 0, data.sensitive ? 1 : 0,
    data.sourceQuote ?? null, data.sourceLocation ?? null, data.modelUsed ?? null,
    data.canonCategory ?? null, data.canonicalStatement ?? null,
    data.locked ? 1 : 0, data.conflictStatus ?? null, data.publicAutomationAllowed ? 1 : 0,
    data.copyText ?? null, data.suggestedChannel ?? null, data.suggestedUse ?? null,
    data.emotionalAngle ?? null, data.audience ?? null, data.approvedForAutomation ? 1 : 0,
    data.internalCategory ?? null, data.sensitivityLevel ?? null,
    data.whyItMatters ?? null, data.reviewPriority ?? null,
    data.reviewedBy ?? null, data.reviewedAt ?? null, now, now,
    data.sourceSection ?? null,
    data.sourceExcerpt ?? null,
    data.marketingAngle ?? null,
    data.suggestedRewrite ?? null,
    data.useFor ? JSON.stringify(data.useFor) : null,
    data.reviewAudience ? JSON.stringify(data.reviewAudience) : null,
    data.funnelStage ?? null,
    data.contentType ? JSON.stringify(data.contentType) : null,
    data.reviewConfidence ?? null,
    data.proofStrength ?? null,
    data.claimRisk ?? null,
    data.linkBackRequired ? 1 : 0,
    data.reviewSummaryId ?? null,
    data.rubricVersion ?? null
  );

  return getLibraryEntry(id)!;
}

export function getLibraryEntry(id: string): LibraryEntry | null {
  const row = db
    .prepare(`SELECT * FROM library_entries WHERE id = ?`)
    .get(id) as RawEntryRow | undefined;
  return row ? mapEntry(row) : null;
}

export function updateLibraryEntry(
  id: string,
  updates: Partial<
    Omit<LibraryEntry, "id" | "sourceDocumentId" | "importBatchId" | "createdAt">
  >
): void {
  const fields: string[] = [];
  const values: unknown[] = [];
  const now = new Date().toISOString();

  const colMap: Record<string, string> = {
    entryType: "entry_type",
    title: "title",
    content: "content",
    summary: "summary",
    visibility: "visibility",
    status: "status",
    confidenceScore: "confidence_score",
    memoryValueScore: "memory_value_score",
    publicSafe: "public_safe",
    sensitive: "sensitive",
    sourceQuote: "source_quote",
    sourceLocation: "source_location",
    modelUsed: "model_used",
    canonCategory: "canon_category",
    canonicalStatement: "canonical_statement",
    locked: "locked",
    conflictStatus: "conflict_status",
    publicAutomationAllowed: "public_automation_allowed",
    copyText: "copy_text",
    suggestedChannel: "suggested_channel",
    suggestedUse: "suggested_use",
    emotionalAngle: "emotional_angle",
    audience: "audience",
    approvedForAutomation: "approved_for_automation",
    internalCategory: "internal_category",
    sensitivityLevel: "sensitivity_level",
    whyItMatters: "why_it_matters",
    reviewPriority: "review_priority",
    reviewedBy: "reviewed_by",
    reviewedAt: "reviewed_at",
  };

  for (const [key, col] of Object.entries(colMap)) {
    if (key in updates) {
      fields.push(`${col} = ?`);
      const val = updates[key as keyof typeof updates];
      if (key === "tags" && Array.isArray(val)) {
        values.push(JSON.stringify(val));
      } else if (typeof val === "boolean") {
        values.push(val ? 1 : 0);
      } else {
        values.push(val ?? null);
      }
    }
  }

  // Handle tags separately (not in colMap above to handle JSON serialisation)
  if ("tags" in updates && Array.isArray(updates.tags)) {
    fields.push("tags = ?");
    values.push(JSON.stringify(updates.tags));
  }

  fields.push("updated_at = ?");
  values.push(now);
  values.push(id);

  db.prepare(
    `UPDATE library_entries SET ${fields.join(", ")} WHERE id = ?`
  ).run(...values);
}

export function listLibraryEntries(filters: LibraryEntryFilters = {}): LibraryEntry[] {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.entryType) {
    conditions.push("entry_type = ?");
    values.push(filters.entryType);
  }
  if (filters.status) {
    conditions.push("status = ?");
    values.push(filters.status);
  }
  if (filters.visibility) {
    conditions.push("visibility = ?");
    values.push(filters.visibility);
  }
  if (filters.publicSafe !== undefined) {
    conditions.push("public_safe = ?");
    values.push(filters.publicSafe ? 1 : 0);
  }
  if (filters.sensitive !== undefined) {
    conditions.push("sensitive = ?");
    values.push(filters.sensitive ? 1 : 0);
  }
  if (filters.initiativeSlug) {
    conditions.push("initiative_slug = ?");
    values.push(filters.initiativeSlug);
  }
  if (filters.importBatchId) {
    conditions.push("import_batch_id = ?");
    values.push(filters.importBatchId);
  }
  if (filters.sourceDocumentId) {
    conditions.push("source_document_id = ?");
    values.push(filters.sourceDocumentId);
  }
  if (filters.minConfidence !== undefined) {
    conditions.push("confidence_score >= ?");
    values.push(filters.minConfidence);
  }
  if (filters.minMemoryValue !== undefined) {
    conditions.push("memory_value_score >= ?");
    values.push(filters.minMemoryValue);
  }
  if (filters.searchQuery) {
    conditions.push(
      "(title LIKE ? OR content LIKE ? OR summary LIKE ? OR canonical_statement LIKE ? OR copy_text LIKE ?)"
    );
    const q = `%${filters.searchQuery}%`;
    values.push(q, q, q, q, q);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM library_entries ${where} ORDER BY created_at DESC`)
    .all(...values) as RawEntryRow[];
  return rows.map(mapEntry);
}

/** Returns all candidate-status entries for the review queue. */
export function listReviewQueue(): LibraryEntry[] {
  const rows = db
    .prepare(
      `SELECT * FROM library_entries WHERE status = 'candidate' ORDER BY memory_value_score DESC, created_at ASC`
    )
    .all() as RawEntryRow[];
  return rows.map(mapEntry);
}

/** Returns entries that pass all public automation safety gates (raw DB check). */
export function listPublicAutomationApproved(): LibraryEntry[] {
  const rows = db
    .prepare(`
      SELECT e.* FROM library_entries e
      LEFT JOIN library_source_documents d ON e.source_document_id = d.id
      WHERE e.visibility = 'public'
        AND e.public_safe = 1
        AND e.status IN ('approved', 'locked')
        AND e.sensitive = 0
        AND e.approved_for_automation = 1
        AND (e.conflict_status IS NULL OR e.conflict_status = 'resolved')
        AND e.entry_type != 'internal_note'
        AND (d.moved_to_trash_at IS NULL)
      ORDER BY e.memory_value_score DESC
    `)
    .all() as RawEntryRow[];
  return rows.map(mapEntry);
}

/** Full-text search across all entry types. */
export function searchLibraryEntries(
  query: string,
  filters: Omit<LibraryEntryFilters, "searchQuery"> = {}
): LibraryEntry[] {
  return listLibraryEntries({ ...filters, searchQuery: query });
}

/** Returns all approved canon entries for conflict checking. */
export function listApprovedCanon(): LibraryEntry[] {
  const rows = db
    .prepare(
      `SELECT * FROM library_entries WHERE entry_type = 'canon' AND status IN ('approved', 'locked') ORDER BY created_at DESC`
    )
    .all() as RawEntryRow[];
  return rows.map(mapEntry);
}

// ─────────────────────────────────────────────────────────────────────────────
// Conflict CRUD
// ─────────────────────────────────────────────────────────────────────────────

export function createConflict(data: {
  existingEntryId: string;
  challengerEntryId: string;
  conflictReason: string;
  severity: ConflictSeverity;
}): ConflictRecord {
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO library_conflicts
      (id, existing_entry_id, challenger_entry_id, conflict_reason, severity, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.existingEntryId,
    data.challengerEntryId,
    data.conflictReason,
    data.severity,
    createdAt
  );

  return getConflict(id)!;
}

export function getConflict(id: string): ConflictRecord | null {
  const row = db
    .prepare(`SELECT * FROM library_conflicts WHERE id = ?`)
    .get(id) as RawConflictRow | undefined;
  return row ? mapConflict(row) : null;
}

export function listUnresolvedConflicts(): ConflictRecord[] {
  const rows = db
    .prepare(
      `SELECT * FROM library_conflicts WHERE resolution IS NULL ORDER BY created_at DESC`
    )
    .all() as RawConflictRow[];
  return rows.map(mapConflict);
}

export function resolveConflict(
  id: string,
  resolution: ConflictResolution
): void {
  const resolvedAt = new Date().toISOString();
  db.prepare(
    `UPDATE library_conflicts SET resolution = ?, resolved_at = ? WHERE id = ?`
  ).run(resolution, resolvedAt, id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Trash CRUD
// ─────────────────────────────────────────────────────────────────────────────

export function createTrashRecord(data: {
  sourceDocumentId: string;
  originalFilename: string;
  reason: string;
  confidenceScore: number;
  importBatchId: string;
}): TrashRecord {
  const id = randomUUID();
  const movedAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO library_trash_records
      (id, source_document_id, original_filename, reason, confidence_score, import_batch_id, moved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.sourceDocumentId,
    data.originalFilename,
    data.reason,
    data.confidenceScore,
    data.importBatchId,
    movedAt
  );

  // Also mark the source document as trashed
  updateSourceDocument(data.sourceDocumentId, { movedToTrashAt: movedAt });

  return listTrashRecords().find((r) => r.id === id)!;
}

export function listTrashRecords(): TrashRecord[] {
  const rows = db
    .prepare(
      `SELECT * FROM library_trash_records ORDER BY moved_at DESC`
    )
    .all() as RawTrashRow[];
  return rows.map(mapTrash);
}

export function restoreFromTrash(trashRecordId: string): void {
  const restoredAt = new Date().toISOString();

  const record = db
    .prepare(`SELECT * FROM library_trash_records WHERE id = ?`)
    .get(trashRecordId) as RawTrashRow | undefined;

  if (!record) throw new Error(`Trash record ${trashRecordId} not found`);

  db.prepare(
    `UPDATE library_trash_records SET restored_at = ?, restore_available = 0 WHERE id = ?`
  ).run(restoredAt, trashRecordId);

  // Clear the moved-to-trash marker on the source document
  updateSourceDocument(record.source_document_id, {
    movedToTrashAt: undefined,
    restoredAt,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Counts (for nav badges)
// ─────────────────────────────────────────────────────────────────────────────

export function getLibraryCounts(): {
  reviewQueue: number;
  canon: number;
  marketing: number;
  internal: number;
  conflicts: number;
  trash: number;
  imports: number;
  redFlags: number;
  assetOpportunities: number;
} {
  const reviewQueue = (
    db
      .prepare(`SELECT COUNT(*) as c FROM library_entries WHERE status = 'candidate'`)
      .get() as { c: number }
  ).c;

  const canon = (
    db
      .prepare(`SELECT COUNT(*) as c FROM library_entries WHERE entry_type = 'canon' AND status NOT IN ('candidate', 'rejected')`)
      .get() as { c: number }
  ).c;

  const marketing = (
    db
      .prepare(`SELECT COUNT(*) as c FROM library_entries WHERE entry_type = 'marketing_nugget' AND status NOT IN ('candidate', 'rejected')`)
      .get() as { c: number }
  ).c;

  const internal = (
    db
      .prepare(`SELECT COUNT(*) as c FROM library_entries WHERE entry_type = 'internal_note' AND status NOT IN ('candidate', 'archived')`)
      .get() as { c: number }
  ).c;

  const conflicts = (
    db
      .prepare(`SELECT COUNT(*) as c FROM library_conflicts WHERE resolution IS NULL`)
      .get() as { c: number }
  ).c;

  const trash = (
    db
      .prepare(`SELECT COUNT(*) as c FROM library_trash_records WHERE restored_at IS NULL`)
      .get() as { c: number }
  ).c;

  const imports = (
    db
      .prepare(`SELECT COUNT(*) as c FROM library_import_batches`)
      .get() as { c: number }
  ).c;

  const redFlags = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM library_marketing_red_flags WHERE resolved_at IS NULL`
      )
      .get() as { c: number }
  ).c;

  const assetOpportunities = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM library_marketing_asset_opportunities
         WHERE status IN ('proposed', 'accepted', 'drafted')`
      )
      .get() as { c: number }
  ).c;

  return {
    reviewQueue, canon, marketing, internal, conflicts, trash, imports,
    redFlags, assetOpportunities,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Docs-as-marketing review — summaries, red flags, asset opportunities
// ─────────────────────────────────────────────────────────────────────────────

export function createMarketingReviewSummary(data: {
  id?: string;
  sourceDocumentId: string;
  importBatchId: string;
  overallScore: number;
  bestMarketingUses: MarketingUseFor[];
  highestValueTheme?: string | null;
  rubricVersion?: string;
  reviewedAt?: string;
}): MarketingReviewSummary {
  const id = data.id ?? randomUUID();
  const now = new Date().toISOString();
  const reviewedAt = data.reviewedAt ?? now;
  const rubricVersion = data.rubricVersion ?? "docs-as-marketing.v1";

  db.prepare(`
    INSERT INTO library_marketing_review_summaries
      (id, source_document_id, import_batch_id, overall_score,
       best_marketing_uses, highest_value_theme, rubric_version,
       reviewed_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.sourceDocumentId,
    data.importBatchId,
    data.overallScore,
    JSON.stringify(data.bestMarketingUses),
    data.highestValueTheme ?? null,
    rubricVersion,
    reviewedAt,
    now
  );

  return getMarketingReviewSummary(id)!;
}

export function getMarketingReviewSummary(
  id: string
): MarketingReviewSummary | null {
  const row = db
    .prepare(`SELECT * FROM library_marketing_review_summaries WHERE id = ?`)
    .get(id) as RawMarketingReviewSummaryRow | undefined;
  return row ? mapMarketingReviewSummary(row) : null;
}

export function listMarketingReviewSummariesByDocument(
  sourceDocumentId: string
): MarketingReviewSummary[] {
  const rows = db
    .prepare(
      `SELECT * FROM library_marketing_review_summaries
       WHERE source_document_id = ?
       ORDER BY reviewed_at DESC`
    )
    .all(sourceDocumentId) as RawMarketingReviewSummaryRow[];
  return rows.map(mapMarketingReviewSummary);
}

export function getLatestMarketingReviewSummary(
  sourceDocumentId: string
): MarketingReviewSummary | null {
  const row = db
    .prepare(
      `SELECT * FROM library_marketing_review_summaries
       WHERE source_document_id = ?
       ORDER BY reviewed_at DESC LIMIT 1`
    )
    .get(sourceDocumentId) as RawMarketingReviewSummaryRow | undefined;
  return row ? mapMarketingReviewSummary(row) : null;
}

// ── Red flags ────────────────────────────────────────────────────────────────

export function createMarketingRedFlag(data: {
  id?: string;
  sourceDocumentId: string;
  reviewSummaryId?: string | null;
  libraryEntryId?: string | null;
  sourceExcerpt: string;
  riskLevel: MarketingClaimRisk;
  issue: string;
  saferWording?: string | null;
  proofRequirement?: string | null;
}): MarketingRedFlag {
  if (!data.saferWording && !data.proofRequirement) {
    throw new Error(
      "MarketingRedFlag requires saferWording or proofRequirement (per skill contract)"
    );
  }

  const id = data.id ?? randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO library_marketing_red_flags
      (id, source_document_id, review_summary_id, library_entry_id,
       source_excerpt, risk_level, issue, safer_wording, proof_requirement,
       created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.sourceDocumentId,
    data.reviewSummaryId ?? null,
    data.libraryEntryId ?? null,
    data.sourceExcerpt,
    data.riskLevel,
    data.issue,
    data.saferWording ?? null,
    data.proofRequirement ?? null,
    now
  );

  return getMarketingRedFlag(id)!;
}

export function getMarketingRedFlag(id: string): MarketingRedFlag | null {
  const row = db
    .prepare(`SELECT * FROM library_marketing_red_flags WHERE id = ?`)
    .get(id) as RawMarketingRedFlagRow | undefined;
  return row ? mapMarketingRedFlag(row) : null;
}

export function listMarketingRedFlagsByDocument(
  sourceDocumentId: string
): MarketingRedFlag[] {
  const rows = db
    .prepare(
      `SELECT * FROM library_marketing_red_flags
       WHERE source_document_id = ?
       ORDER BY created_at DESC`
    )
    .all(sourceDocumentId) as RawMarketingRedFlagRow[];
  return rows.map(mapMarketingRedFlag);
}

export function listMarketingRedFlagsBySummary(
  reviewSummaryId: string
): MarketingRedFlag[] {
  const rows = db
    .prepare(
      `SELECT * FROM library_marketing_red_flags
       WHERE review_summary_id = ?
       ORDER BY created_at DESC`
    )
    .all(reviewSummaryId) as RawMarketingRedFlagRow[];
  return rows.map(mapMarketingRedFlag);
}

export function listUnresolvedMarketingRedFlags(): MarketingRedFlag[] {
  const rows = db
    .prepare(
      `SELECT * FROM library_marketing_red_flags
       WHERE resolved_at IS NULL
       ORDER BY
         CASE risk_level
           WHEN 'High' THEN 0
           WHEN 'Medium' THEN 1
           WHEN 'Low' THEN 2
           ELSE 3
         END,
         created_at DESC`
    )
    .all() as RawMarketingRedFlagRow[];
  return rows.map(mapMarketingRedFlag);
}

export function resolveMarketingRedFlag(
  id: string,
  resolutionNote?: string
): void {
  const resolvedAt = new Date().toISOString();
  db.prepare(
    `UPDATE library_marketing_red_flags
     SET resolved_at = ?, resolution_note = ?
     WHERE id = ?`
  ).run(resolvedAt, resolutionNote ?? null, id);
}

// ── Asset opportunities ──────────────────────────────────────────────────────

export function createMarketingAssetOpportunity(data: {
  id?: string;
  sourceDocumentId: string;
  reviewSummaryId?: string | null;
  assetType: string;
  theme: string;
  priority?: MarketingAssetPriority;
  status?: MarketingAssetStatus;
  notes?: string | null;
}): MarketingAssetOpportunity {
  const id = data.id ?? randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO library_marketing_asset_opportunities
      (id, source_document_id, review_summary_id, asset_type, theme,
       priority, status, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.sourceDocumentId,
    data.reviewSummaryId ?? null,
    data.assetType,
    data.theme,
    data.priority ?? "Medium",
    data.status ?? "proposed",
    data.notes ?? null,
    now
  );

  return getMarketingAssetOpportunity(id)!;
}

export function getMarketingAssetOpportunity(
  id: string
): MarketingAssetOpportunity | null {
  const row = db
    .prepare(`SELECT * FROM library_marketing_asset_opportunities WHERE id = ?`)
    .get(id) as RawMarketingAssetOpportunityRow | undefined;
  return row ? mapMarketingAssetOpportunity(row) : null;
}

export function listMarketingAssetOpportunitiesByDocument(
  sourceDocumentId: string
): MarketingAssetOpportunity[] {
  const rows = db
    .prepare(
      `SELECT * FROM library_marketing_asset_opportunities
       WHERE source_document_id = ?
       ORDER BY
         CASE priority
           WHEN 'High' THEN 0
           WHEN 'Medium' THEN 1
           WHEN 'Low' THEN 2
           ELSE 3
         END,
         created_at DESC`
    )
    .all(sourceDocumentId) as RawMarketingAssetOpportunityRow[];
  return rows.map(mapMarketingAssetOpportunity);
}

export function listOpenMarketingAssetOpportunities(): MarketingAssetOpportunity[] {
  const rows = db
    .prepare(
      `SELECT * FROM library_marketing_asset_opportunities
       WHERE status IN ('proposed', 'accepted', 'drafted')
       ORDER BY
         CASE priority
           WHEN 'High' THEN 0
           WHEN 'Medium' THEN 1
           WHEN 'Low' THEN 2
           ELSE 3
         END,
         created_at DESC`
    )
    .all() as RawMarketingAssetOpportunityRow[];
  return rows.map(mapMarketingAssetOpportunity);
}

export function updateMarketingAssetOpportunityStatus(
  id: string,
  status: MarketingAssetStatus,
  notes?: string | null
): void {
  if (notes === undefined) {
    db.prepare(
      `UPDATE library_marketing_asset_opportunities SET status = ? WHERE id = ?`
    ).run(status, id);
  } else {
    db.prepare(
      `UPDATE library_marketing_asset_opportunities
       SET status = ?, notes = ?
       WHERE id = ?`
    ).run(status, notes, id);
  }
}

// ── Transactional helper for the writer ──────────────────────────────────────

/**
 * Wraps a function in a single SQLite transaction. Re-thrown errors roll back
 * the whole batch, which is what the marketing-review writer needs to honour
 * the skill's "abort the whole transaction on any tag violation" rule.
 */
export function withTransaction<T>(fn: () => T): T {
  return db.transaction(fn)();
}
