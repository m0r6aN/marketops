"use server";
/**
 * Library Canon Foundry — server actions.
 *
 * All user-initiated review, approval, and management actions.
 * Follows the pattern established in src/app/actions/readiness.ts.
 */
import {
    buildProcessingClient,
    runPublicSafetyReview,
    type ProcessingClientOptions,
} from "@/lib/library/processor";
import {
    buildMarketingRewritePrompt,
    type MarketingRewriteResult,
} from "@/lib/library/prompts";
import {
    createTrashRecord,
    getLibraryEntry,
    listReviewQueue,
    listUnresolvedConflicts,
    resolveConflict as repoResolveConflict,
    resolveMarketingRedFlag as repoResolveMarketingRedFlag,
    restoreFromTrash as repoRestoreFromTrash,
    updateMarketingAssetOpportunityStatus as repoUpdateAssetOpportunityStatus,
    updateLibraryEntry,
} from "@/lib/library/repository";
import { checkPublicSafetyGates, flagForPublicPromotion } from "@/lib/library/service";
import type {
    ConflictResolution, LibraryEntry,
    MarketingAssetStatus,
} from "@/lib/library/types";
import { revalidatePath } from "next/cache";

type ReviewQueueAssistantAction =
  | "approve_canon"
  | "approve_marketing"
  | "approve_internal"
  | "reject"
  | "flag_sensitive"
  | "rewrite_marketing"
  | "safety_review"
  | "skip";

type ReviewQueueAssistantDecision = {
  action: ReviewQueueAssistantAction;
  reason: string;
  confidence: number;
};

type ReviewQueueAssistantDecisionPayload = Partial<ReviewQueueAssistantDecision> & {
  entryId?: string;
};

type ReviewQueueAssistantBatchResponse = {
  decisions?: ReviewQueueAssistantDecisionPayload[];
};

type ReviewQueueAssistantCandidate = {
  entry: LibraryEntry;
  hasConflict: boolean;
};

const REVIEW_QUEUE_ASSISTANT_ACTIONS: ReviewQueueAssistantAction[] = [
  "approve_canon",
  "approve_marketing",
  "approve_internal",
  "reject",
  "flag_sensitive",
  "rewrite_marketing",
  "safety_review",
  "skip",
];

export type ReviewQueueAssistantResult = {
  evaluated: number;
  executed: number;
  skipped: number;
  actions: Array<ReviewQueueAssistantDecision & { entryId: string; title: string }>;
  failures: Array<{ entryId: string; title: string; error: string }>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function revalidateLibrary() {
  revalidatePath("/library");
  revalidatePath("/library/review");
  revalidatePath("/library/canon");
  revalidatePath("/library/marketing");
  revalidatePath("/library/internal");
  revalidatePath("/library/conflicts");
  revalidatePath("/library/trash");
  revalidatePath("/library/imports");
  revalidatePath("/library/red-flags");
  revalidatePath("/library/asset-opportunities");
}

// ─────────────────────────────────────────────────────────────────────────────
// Docs-as-marketing review actions
// ─────────────────────────────────────────────────────────────────────────────

export async function resolveMarketingRedFlag(
  id: string,
  resolutionNote?: string
): Promise<void> {
  repoResolveMarketingRedFlag(id, resolutionNote);
  revalidateLibrary();
}

export async function updateAssetOpportunityStatus(
  id: string,
  status: MarketingAssetStatus,
  notes?: string | null
): Promise<void> {
  repoUpdateAssetOpportunityStatus(id, status, notes ?? undefined);
  revalidateLibrary();
}

// ─────────────────────────────────────────────────────────────────────────────
// Review queue actions
// ─────────────────────────────────────────────────────────────────────────────

export async function approveAsCanon(
  entryId: string,
  edits?: Partial<Pick<LibraryEntry, "title" | "content" | "canonicalStatement" | "canonCategory" | "tags" | "summary">>
) {
  const entry = getLibraryEntry(entryId);
  if (!entry) throw new Error(`Entry ${entryId} not found`);

  updateLibraryEntry(entryId, {
    entryType: "canon",
    status: "approved",
    visibility: "private",  // stays private until explicitly promoted
    reviewedAt: new Date().toISOString(),
    ...edits,
  });

  revalidateLibrary();
}

export async function approveAsMarketing(
  entryId: string,
  edits?: Partial<Pick<LibraryEntry, "title" | "copyText" | "suggestedUse" | "suggestedChannel" | "emotionalAngle" | "audience" | "tags">>
) {
  const entry = getLibraryEntry(entryId);
  if (!entry) throw new Error(`Entry ${entryId} not found`);

  updateLibraryEntry(entryId, {
    entryType: "marketing_nugget",
    status: "approved",
    reviewedAt: new Date().toISOString(),
    ...edits,
  });

  revalidateLibrary();
}

export async function approveAsInternal(
  entryId: string,
  edits?: Partial<Pick<LibraryEntry, "title" | "content" | "summary" | "internalCategory" | "sensitivityLevel" | "whyItMatters" | "reviewPriority" | "tags">>
) {
  const entry = getLibraryEntry(entryId);
  if (!entry) throw new Error(`Entry ${entryId} not found`);

  updateLibraryEntry(entryId, {
    entryType: "internal_note",
    status: "saved",
    visibility: "internal",
    reviewedAt: new Date().toISOString(),
    ...edits,
  });

  revalidateLibrary();
}

export async function rejectEntry(entryId: string) {
  updateLibraryEntry(entryId, { status: "rejected" });
  revalidateLibrary();
}

export async function editAndApprove(
  entryId: string,
  updates: Partial<LibraryEntry>
) {
  const entry = getLibraryEntry(entryId);
  if (!entry) throw new Error(`Entry ${entryId} not found`);

  updateLibraryEntry(entryId, {
    ...updates,
    status: "approved",
    reviewedAt: new Date().toISOString(),
  });

  revalidateLibrary();
}

export async function flagSensitive(entryId: string) {
  updateLibraryEntry(entryId, {
    sensitive: true,
    publicSafe: false,
    visibility: "internal",
  });
  revalidateLibrary();
}

export async function runReviewQueueAssistant(
  options: ProcessingClientOptions = { useOllama: true }
): Promise<ReviewQueueAssistantResult> {
  const entries = listReviewQueue();
  const conflicts = listUnresolvedConflicts();
  const conflictedEntryIds = new Set(
    conflicts.flatMap((c) => [c.existingEntryId, c.challengerEntryId])
  );
  const client = buildProcessingClient(options);
  const result: ReviewQueueAssistantResult = {
    evaluated: entries.length,
    executed: 0,
    skipped: 0,
    actions: [],
    failures: [],
  };

  if (entries.length === 0) {
    return result;
  }

  const candidates = entries.map((entry) => ({
    entry,
    hasConflict: conflictedEntryIds.has(entry.id),
  }));

  let decisionsByEntryId: Map<string, ReviewQueueAssistantDecisionPayload>;

  try {
    decisionsByEntryId = await getReviewQueueDecisions(client, candidates);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown assistant error";
    for (const entry of entries) {
      result.failures.push({ entryId: entry.id, title: entry.title, error: message });
    }
    return result;
  }

  for (const entry of entries) {
    try {
      const decision = normalizeReviewQueueDecision(
        decisionsByEntryId.get(entry.id) ?? {
          action: "skip",
          reason: "Assistant did not return a decision for this candidate.",
          confidence: 0,
        }
      );

      if (decision.action === "skip") {
        result.skipped += 1;
      } else {
        await executeReviewQueueDecision(entry.id, decision.action, options);
        result.executed += 1;
      }

      result.actions.push({ ...decision, entryId: entry.id, title: entry.title });
    } catch (error) {
      result.failures.push({
        entryId: entry.id,
        title: entry.title,
        error: error instanceof Error ? error.message : "Unknown assistant error",
      });
    }
  }

  revalidateLibrary();
  return result;
}

async function getReviewQueueDecisions(
  client: ReturnType<typeof buildProcessingClient>,
  candidates: ReviewQueueAssistantCandidate[]
): Promise<Map<string, ReviewQueueAssistantDecisionPayload>> {
  const response = await client.callJson<ReviewQueueAssistantBatchResponse>(
    `You are the MarketOps review queue assistant. Choose exactly one action for each candidate.

Allowed actions: approve_canon, approve_marketing, approve_internal, reject, flag_sensitive, rewrite_marketing, safety_review, skip.

Rules:
- Return one decision for every candidate entryId, and never invent entryIds.
- If hasConflict is true, do not approve. Choose safety_review or skip.
- If sensitive is true, choose flag_sensitive unless it is already internal-only.
- Use approve_canon for durable positioning, product facts, glossary, mission, audience, proof-backed canon.
- Use approve_marketing for polished public-safe copy, benefits, hooks, campaign angles.
- Use rewrite_marketing when the idea is valuable but raw, verbose, or not campaign-ready.
- Use approve_internal for strategy notes, operational notes, or private reference material.
- Use reject for duplicates, weak snippets, unsupported claims, or low-value extraction noise.

Return only JSON: { "decisions": [{ "entryId": "id", "action": "approve_marketing", "reason": "short reason", "confidence": 0.0 }] }`,
    JSON.stringify({
      candidates: candidates.map(({ entry, hasConflict }) => ({
        entryId: entry.id,
        title: entry.title,
        entryType: entry.entryType,
        status: entry.status,
        hasConflict,
        sensitive: entry.sensitive,
        publicSafe: entry.publicSafe,
        confidenceScore: entry.confidenceScore,
        memoryValueScore: entry.memoryValueScore,
        tags: entry.tags,
        content: (
          entry.canonicalStatement ??
          entry.copyText ??
          entry.content ??
          entry.summary ??
          ""
        ).slice(0, 1000),
        source: (entry.sourceQuote ?? entry.sourceExcerpt ?? "").slice(0, 500),
      })),
    })
  );

  return new Map(
    (response.decisions ?? [])
      .filter((decision) => typeof decision.entryId === "string")
      .map((decision) => [decision.entryId as string, decision])
  );
}

function normalizeReviewQueueDecision(
  decision: Partial<ReviewQueueAssistantDecision>
): ReviewQueueAssistantDecision {
  const action = REVIEW_QUEUE_ASSISTANT_ACTIONS.includes(
    decision.action as ReviewQueueAssistantAction
  )
    ? (decision.action as ReviewQueueAssistantAction)
    : "skip";
  const confidence =
    typeof decision.confidence === "number" && Number.isFinite(decision.confidence)
      ? Math.max(0, Math.min(1, decision.confidence))
      : 0;

  return {
    action,
    confidence,
    reason: decision.reason?.slice(0, 240) || "Assistant did not provide a reason.",
  };
}

async function executeReviewQueueDecision(
  entryId: string,
  action: ReviewQueueAssistantAction,
  options: ProcessingClientOptions
) {
  switch (action) {
    case "approve_canon":
      return approveAsCanon(entryId);
    case "approve_marketing":
      return approveAsMarketing(entryId);
    case "approve_internal":
      return approveAsInternal(entryId);
    case "reject":
      return rejectEntry(entryId);
    case "flag_sensitive":
      return flagSensitive(entryId);
    case "rewrite_marketing":
      return rewriteAsMarketing(entryId, options);
    case "safety_review":
      return requestStrongModelReview(entryId, options);
    case "skip":
      return undefined;
  }
}

export async function requestStrongModelReview(
  entryId: string,
  options: ProcessingClientOptions = {}
) {
  // Run a public-safety review and update the entry with the result.
  // This is the same review used during promotion to public.
  const result = await runPublicSafetyReview(entryId, options);

  updateLibraryEntry(entryId, {
    publicSafe: result.publicSafe,
    sensitive: !result.publicSafe && result.sensitiveFlags.length > 0,
  });

  revalidateLibrary();
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canon management
// ─────────────────────────────────────────────────────────────────────────────

export async function lockCanon(entryId: string) {
  const entry = getLibraryEntry(entryId);
  if (!entry) throw new Error(`Entry ${entryId} not found`);
  if (entry.status !== "approved") {
    throw new Error("Only approved canon can be locked");
  }

  updateLibraryEntry(entryId, { status: "locked", locked: true });
  revalidateLibrary();
}

export async function deprecateCanon(entryId: string, supersededById?: string) {
  updateLibraryEntry(entryId, {
    status: "deprecated",
    locked: false,
    publicAutomationAllowed: false,
    approvedForAutomation: false,
  });
  void supersededById; // Could add supersedes_entry_id if schema is extended
  revalidateLibrary();
}

export async function togglePublicAutomation(entryId: string, allowed: boolean) {
  const entry = getLibraryEntry(entryId);
  if (!entry) throw new Error(`Entry ${entryId} not found`);

  if (allowed) {
    // Must pass all safety gates before enabling.
    // Exclude conditions that this action itself satisfies:
    //   - approved_for_automation  (set below)
    //   - visibility               (promoted to 'public' below)
    //   - public_safe              (affirmed by the human enabling automation)
    const gateCheck = checkPublicSafetyGates(entryId);
    const selfSatisfiedConditions = [
      "approved_for_automation",
      "visibility must be 'public'",
      "public_safe must be true",
    ];
    const blockingFailures = gateCheck.failedConditions.filter(
      (c) => !selfSatisfiedConditions.some((s) => c.includes(s))
    );
    if (blockingFailures.length > 0) {
      throw new Error(
        `Cannot enable automation: ${blockingFailures.join("; ")}`
      );
    }

    // Enabling automation is the explicit human decision that makes an entry
    // public and asserts it passed the safety review.
    updateLibraryEntry(entryId, {
      publicAutomationAllowed: true,
      approvedForAutomation: true,
      visibility: "public",
      publicSafe: true,
    });
  } else {
    // Revoking automation drops the entry back to private.
    updateLibraryEntry(entryId, {
      publicAutomationAllowed: false,
      approvedForAutomation: false,
      visibility: "private",
    });
  }

  revalidateLibrary();
}

// ─────────────────────────────────────────────────────────────────────────────
// Conflict resolution
// ─────────────────────────────────────────────────────────────────────────────

export async function resolveConflict(
  conflictId: string,
  resolution: ConflictResolution
) {
  repoResolveConflict(conflictId, resolution);

  // If resolution keeps the challenger, mark it as resolved
  // (Actual content merging is left to a future edit)
  revalidateLibrary();
}

// ─────────────────────────────────────────────────────────────────────────────
// Trash management
// ─────────────────────────────────────────────────────────────────────────────

export async function moveToTrash(sourceDocId: string, reason: string) {
  const { getSourceDocument } = await import("@/lib/library/repository");
  const doc = getSourceDocument(sourceDocId);
  if (!doc) throw new Error(`Source document ${sourceDocId} not found`);

  createTrashRecord({
    sourceDocumentId: sourceDocId,
    originalFilename: doc.originalFilename,
    reason,
    confidenceScore: doc.usefulnessScore,
    importBatchId: doc.importBatchId,
  });

  revalidateLibrary();
}

export async function restoreFromTrash(trashRecordId: string) {
  repoRestoreFromTrash(trashRecordId);
  revalidateLibrary();
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal → public promotion (triggers strong-model safety review)
// ─────────────────────────────────────────────────────────────────────────────

export async function promoteToPublicCandidate(entryId: string) {
  const entry = getLibraryEntry(entryId);
  if (!entry) throw new Error(`Entry ${entryId} not found`);

  // Run strong-model safety review before any visibility change
  const safetyResult = await runPublicSafetyReview(entryId);

  if (!safetyResult.publicSafe) {
    // Do NOT change visibility — return issues to the caller
    updateLibraryEntry(entryId, {
      sensitive: true,
      publicSafe: false,
    });
    revalidateLibrary();
    return {
      promoted: false,
      reason: "Failed public safety review",
      sensitiveFlags: safetyResult.sensitiveFlags,
    };
  }

  // Safety passed — flag as public candidate, still requires human approval
  flagForPublicPromotion(entryId);
  updateLibraryEntry(entryId, {
    publicSafe: true,
    sensitive: false,
    visibility: "private",  // Still private until human approves
    status: "needs_review", // Surface in review queue
  });

  revalidateLibrary();
  return { promoted: true, reason: "Safety review passed — awaiting human approval" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mark internal note as important
// ─────────────────────────────────────────────────────────────────────────────

export async function markInternalImportant(entryId: string) {
  updateLibraryEntry(entryId, { status: "important", reviewPriority: "high" });
  revalidateLibrary();
}

export async function archiveEntry(entryId: string) {
  updateLibraryEntry(entryId, { status: "archived" });
  revalidateLibrary();
}

// ─────────────────────────────────────────────────────────────────────────────
// AI rewrite → Marketing Gold
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Passes the entry's content to the LLM, which rewrites it as polished
 * marketing copy, then reclassifies the entry as an approved marketing_nugget.
 */
export async function rewriteAsMarketing(
  entryId: string,
  options: ProcessingClientOptions = {}
) {
  const entry = getLibraryEntry(entryId);
  if (!entry) throw new Error(`Entry ${entryId} not found`);
  const client = buildProcessingClient(options);

  // Assemble the best source text available for this entry
  const sourceText = [
    entry.canonicalStatement,
    entry.content,
    entry.copyText,
    entry.summary,
    entry.sourceQuote,
  ]
    .filter(Boolean)
    .join("\n\n");

  if (!sourceText.trim()) {
    throw new Error("Entry has no content to rewrite");
  }

  const { systemPrompt, userPrompt } = buildMarketingRewritePrompt(
    sourceText,
    entry.title
  );

  const result = await client.callJson<MarketingRewriteResult>(systemPrompt, userPrompt);

  updateLibraryEntry(entryId, {
    entryType: "marketing_nugget",
    status: "approved",
    title: result.title ?? entry.title,
    content: result.copyText ?? entry.content,
    copyText: result.copyText ?? null,
    suggestedUse: result.suggestedUse ?? null,
    suggestedChannel: result.suggestedChannel ?? null,
    emotionalAngle: result.emotionalAngle ?? null,
    audience: result.audience ?? null,
    modelUsed: client.modelUsed,
    visibility: "private",
    reviewedAt: new Date().toISOString(),
    // Clear canon-specific fields that no longer apply
    canonicalStatement: null,
    conflictStatus: null,
  });

  revalidateLibrary();
}

// ─────────────────────────────────────────────────────────────────────────────
// Send back to review queue
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns an approved / classified entry to the review queue as a candidate.
 * Clears all approval state so it can be re-evaluated from scratch.
 */
export async function sendToReview(entryId: string) {
  updateLibraryEntry(entryId, {
    status: "candidate",
    visibility: "private",
    reviewedAt: null,
    approvedForAutomation: false,
    publicAutomationAllowed: false,
    publicSafe: false,
    locked: false,
  });
  revalidateLibrary();
}
