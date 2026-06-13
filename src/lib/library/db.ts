/**
 * Library Canon Foundry — database schema initialisation.
 *
 * Imports the shared better-sqlite3 connection from readiness/db.ts and adds
 * all Library tables in a single migration block.  Tables are created with
 * CREATE TABLE IF NOT EXISTS so this is safe to call on every server start.
 */
import { db } from "@/lib/readiness/db";

db.exec(`
  -- ──────────────────────────────────────────────────────────────────────────
  -- Import batches
  -- One record per user-initiated import session.
  -- ──────────────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS library_import_batches (
    id TEXT PRIMARY KEY,
    selected_modes TEXT NOT NULL DEFAULT '[]',   -- JSON array: ['canon','marketing','internal','trash']
    model_strategy TEXT NOT NULL DEFAULT 'auto', -- auto | sonnet-only
    status TEXT NOT NULL DEFAULT 'pending',      -- pending | processing | completed | failed
    total_files INTEGER NOT NULL DEFAULT 0,
    processed_files INTEGER NOT NULL DEFAULT 0,
    failed_files INTEGER NOT NULL DEFAULT 0,
    entries_extracted INTEGER NOT NULL DEFAULT 0,
    trash_candidates INTEGER NOT NULL DEFAULT 0,
    files_moved_to_trash INTEGER NOT NULL DEFAULT 0,
    conflicts_detected INTEGER NOT NULL DEFAULT 0,
    summary TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL
  );

  -- ──────────────────────────────────────────────────────────────────────────
  -- Source documents
  -- One record per file uploaded in an import batch.
  -- ──────────────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS library_source_documents (
    id TEXT PRIMARY KEY,
    import_batch_id TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    client_relative_path TEXT,
    mime_type TEXT,
    file_size INTEGER,
    content_hash TEXT,
    raw_text TEXT,                               -- normalised text extracted from the file
    parser_status TEXT NOT NULL DEFAULT 'pending',      -- pending | processed | failed
    processing_status TEXT NOT NULL DEFAULT 'pending',  -- pending | processing | processed | failed
    usefulness_score REAL NOT NULL DEFAULT 0,
    trash_recommendation INTEGER NOT NULL DEFAULT 0,    -- 0 | 1
    trash_reason TEXT,
    moved_to_trash_at TEXT,
    restored_at TEXT,
    error_message TEXT,
    ingested_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (import_batch_id) REFERENCES library_import_batches(id)
  );

  -- ──────────────────────────────────────────────────────────────────────────
  -- Library entries
  -- Polymorphic via entry_type.  Canon, marketing-nugget, and internal-note
  -- fields coexist in one table; irrelevant columns are left NULL.
  -- ──────────────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS library_entries (
    id TEXT PRIMARY KEY,
    source_document_id TEXT NOT NULL,
    import_batch_id TEXT NOT NULL,
    entry_type TEXT NOT NULL,                    -- canon | marketing_nugget | internal_note
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    visibility TEXT NOT NULL DEFAULT 'private',  -- public | internal | private
    status TEXT NOT NULL,                        -- see types.ts for per-type status sets
    tags TEXT NOT NULL DEFAULT '[]',             -- JSON array of strings
    confidence_score REAL NOT NULL DEFAULT 0,
    memory_value_score REAL NOT NULL DEFAULT 0,
    public_safe INTEGER NOT NULL DEFAULT 0,      -- 0 | 1
    sensitive INTEGER NOT NULL DEFAULT 0,        -- 0 | 1
    source_quote TEXT,
    source_location TEXT,                        -- chunk index or section hint
    model_used TEXT,

    -- Canon-specific
    canon_category TEXT,
    canonical_statement TEXT,
    locked INTEGER NOT NULL DEFAULT 0,           -- 0 | 1
    conflict_status TEXT,                        -- null | conflicted | resolved
    public_automation_allowed INTEGER NOT NULL DEFAULT 0,

    -- Marketing-nugget-specific
    copy_text TEXT,
    suggested_channel TEXT,
    suggested_use TEXT,
    emotional_angle TEXT,
    audience TEXT,
    approved_for_automation INTEGER NOT NULL DEFAULT 0,

    -- Internal-note-specific
    internal_category TEXT,
    sensitivity_level TEXT,
    why_it_matters TEXT,
    review_priority TEXT,

    -- Audit
    reviewed_by TEXT,
    reviewed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    FOREIGN KEY (source_document_id) REFERENCES library_source_documents(id),
    FOREIGN KEY (import_batch_id) REFERENCES library_import_batches(id)
  );

  -- ──────────────────────────────────────────────────────────────────────────
  -- Conflict records
  -- Created when a new extraction contradicts existing approved/locked canon.
  -- ──────────────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS library_conflicts (
    id TEXT PRIMARY KEY,
    existing_entry_id TEXT NOT NULL,
    challenger_entry_id TEXT NOT NULL,
    conflict_reason TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'minor',      -- minor | major | critical
    resolution TEXT,                             -- keep_existing | replace | merge | reject_new | save_historical
    resolved_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (existing_entry_id) REFERENCES library_entries(id),
    FOREIGN KEY (challenger_entry_id) REFERENCES library_entries(id)
  );

  -- ──────────────────────────────────────────────────────────────────────────
  -- Trash records
  -- Quarantine metadata.  No files are permanently deleted in V1.
  -- ──────────────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS library_trash_records (
    id TEXT PRIMARY KEY,
    source_document_id TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    reason TEXT NOT NULL,
    confidence_score REAL NOT NULL DEFAULT 0,
    import_batch_id TEXT NOT NULL,
    moved_at TEXT NOT NULL,
    restored_at TEXT,
    restore_available INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (source_document_id) REFERENCES library_source_documents(id),
    FOREIGN KEY (import_batch_id) REFERENCES library_import_batches(id)
  );

  -- ──────────────────────────────────────────────────────────────────────────
  -- Docs-as-marketing review summaries
  -- One row per source_document scored by the docs-as-marketing-review skill.
  -- Mirrors the skill's top-level "summary" object.
  -- ──────────────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS library_marketing_review_summaries (
    id TEXT PRIMARY KEY,
    source_document_id TEXT NOT NULL,
    import_batch_id TEXT NOT NULL,
    overall_score INTEGER NOT NULL DEFAULT 0,         -- 0–100
    best_marketing_uses TEXT NOT NULL DEFAULT '[]',   -- JSON array of use_for tags
    highest_value_theme TEXT,
    rubric_version TEXT NOT NULL DEFAULT 'docs-as-marketing.v1',
    reviewed_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (source_document_id) REFERENCES library_source_documents(id),
    FOREIGN KEY (import_batch_id) REFERENCES library_import_batches(id)
  );

  -- ──────────────────────────────────────────────────────────────────────────
  -- Docs-as-marketing red flags
  -- One row per risky claim flagged by the skill. Every row must carry
  -- safer_wording OR proof_requirement (enforced in application code).
  -- ──────────────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS library_marketing_red_flags (
    id TEXT PRIMARY KEY,
    source_document_id TEXT NOT NULL,
    review_summary_id TEXT,
    library_entry_id TEXT,                            -- optional link to a candidate entry
    source_excerpt TEXT NOT NULL,
    risk_level TEXT NOT NULL,                         -- Low | Medium | High
    issue TEXT NOT NULL,
    safer_wording TEXT,
    proof_requirement TEXT,
    resolved_at TEXT,
    resolution_note TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (source_document_id) REFERENCES library_source_documents(id),
    FOREIGN KEY (review_summary_id) REFERENCES library_marketing_review_summaries(id),
    FOREIGN KEY (library_entry_id) REFERENCES library_entries(id)
  );

  -- ──────────────────────────────────────────────────────────────────────────
  -- Docs-as-marketing asset opportunities
  -- One row per downstream asset the source could feed.
  -- ──────────────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS library_marketing_asset_opportunities (
    id TEXT PRIMARY KEY,
    source_document_id TEXT NOT NULL,
    review_summary_id TEXT,
    asset_type TEXT NOT NULL,                         -- e.g. "LinkedIn Post", "One-Pager"
    theme TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'Medium',          -- High | Medium | Low
    status TEXT NOT NULL DEFAULT 'proposed',          -- proposed | accepted | drafted | shipped | rejected
    notes TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (source_document_id) REFERENCES library_source_documents(id),
    FOREIGN KEY (review_summary_id) REFERENCES library_marketing_review_summaries(id)
  );
`);

// ─────────────────────────────────────────────────────────────────────────────
// Additive migrations — safe to re-run on every server start.
// SQLite does not support ALTER TABLE ADD COLUMN IF NOT EXISTS, so we wrap
// each statement in a try/catch that ignores "duplicate column name" errors.
// ─────────────────────────────────────────────────────────────────────────────

const additiveMigrations = [
  `ALTER TABLE library_import_batches ADD COLUMN initiative_slug TEXT`,
  `ALTER TABLE library_entries ADD COLUMN initiative_slug TEXT`,
  `ALTER TABLE library_source_documents ADD COLUMN client_relative_path TEXT`,

  // Docs-as-marketing-review per-candidate fields.
  // These map 1:1 onto the skill's `candidates[]` schema and live alongside
  // the existing marketing-nugget columns so a single library_entries row
  // can carry both legacy and review-derived metadata.
  `ALTER TABLE library_entries ADD COLUMN source_section TEXT`,
  `ALTER TABLE library_entries ADD COLUMN source_excerpt TEXT`,
  `ALTER TABLE library_entries ADD COLUMN marketing_angle TEXT`,
  `ALTER TABLE library_entries ADD COLUMN suggested_rewrite TEXT`,
  `ALTER TABLE library_entries ADD COLUMN use_for TEXT`,              // JSON array of use_for tags
  `ALTER TABLE library_entries ADD COLUMN review_audience TEXT`,      // JSON array (audience tag set)
  `ALTER TABLE library_entries ADD COLUMN funnel_stage TEXT`,         // single funnel_stage value
  `ALTER TABLE library_entries ADD COLUMN content_type TEXT`,         // JSON array of content_type tags
  `ALTER TABLE library_entries ADD COLUMN review_confidence TEXT`,    // Use As-Is | Light Rewrite | ...
  `ALTER TABLE library_entries ADD COLUMN proof_strength TEXT`,       // Strong | Medium | Weak | Unsupported
  `ALTER TABLE library_entries ADD COLUMN claim_risk TEXT`,           // Low | Medium | High
  `ALTER TABLE library_entries ADD COLUMN link_back_required INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE library_entries ADD COLUMN review_summary_id TEXT`,    // FK-ish -> library_marketing_review_summaries.id
  `ALTER TABLE library_entries ADD COLUMN rubric_version TEXT`,
];

for (const sql of additiveMigrations) {
  try {
    db.exec(sql);
  } catch {
    // Column already exists — safe to ignore.
  }
}

export { db };
