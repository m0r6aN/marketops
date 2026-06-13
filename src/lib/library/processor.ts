/**
 * Library Canon Foundry — processing pipeline orchestrator.
 *
 * Takes a source document's extracted text, runs it through the appropriate
 * LLM agents for each selected mode, creates library entry records, and
 * detects conflicts against existing approved canon.
 */
import { callSonnetJson } from "@/lib/library/ai-client";
import { callBlackboxJson } from "@/lib/library/ai-client-blackbox";
import { callOllamaJson } from "@/lib/library/ai-client-ollama";
import {
  defaultRouterConfig,
  resolveModelRoute,
  type ProcessingTask,
} from "@/lib/library/model-router";
import {
  chunkText,
  computeMemoryValueAdjustment,
} from "@/lib/library/parser";
import {
  buildCanonExtractionPrompt,
  buildCombinedExtractionPrompt,
  buildConflictDetectionPrompt,
  buildInternalNotePrompt,
  buildMarketingNuggetPrompt,
  buildTrashDetectionBatchPrompt,
  type CanonExtractionResult,
  type CombinedExtractionResult,
  type ConflictDetectionResult,
  type InternalNoteResult,
  type MarketingNuggetResult,
  type TrashDetectionBatchResult,
} from "@/lib/library/prompts";
import {
  createConflict,
  createLibraryEntry,
  getLibraryEntry,
  listApprovedCanon,
  updateImportBatch,
  updateLibraryEntry,
  updateSourceDocument,
} from "@/lib/library/repository";
import type { LibraryLlmProvider, ProcessingMode } from "@/lib/library/types";

type ExtractionMode = Extract<ProcessingMode, "canon" | "marketing" | "internal">;
type CanonExtractionItem = CanonExtractionResult["entries"][number];
type MarketingExtractionItem = MarketingNuggetResult["entries"][number];
type InternalExtractionItem = InternalNoteResult["entries"][number];

const MAX_CONFLICT_CHECKS_PER_CANDIDATE = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Result type
// ─────────────────────────────────────────────────────────────────────────────

export type ProcessingResult = {
  success: boolean;
  entriesCreated: number;
  trashRecommended: boolean;
  conflictsDetected: number;
  error?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Main pipeline
// ─────────────────────────────────────────────────────────────────────────────

const OLLAMA_MODEL =
  process.env.OLLAMA_MODEL ?? defaultRouterConfig.ollamaModel ?? "llama3.2";

export type ProcessingClientOptions = {
  useOllama?: boolean;
  useBlackbox?: boolean;
};

export type JsonCaller = <T = unknown>(
  systemPrompt: string,
  userPrompt: string
) => Promise<T>;

export type ProcessingClient = {
  provider: LibraryLlmProvider;
  modelUsed: string;
  callJson: JsonCaller;
};

function resolveTaskForModes(modes: ExtractionMode[]): ProcessingTask {
  if (modes.includes("canon")) return "canon_extraction";
  if (modes.includes("marketing")) return "marketing_extraction";
  if (modes.includes("internal")) return "internal_extraction";
  return "marketing_extraction";
}

export function buildProcessingClient(
  options: ProcessingClientOptions = {},
  task: ProcessingTask = "marketing_extraction"
): ProcessingClient {
  const route = resolveModelRoute(task, options);

  if (route.provider === "ollama") {
    return {
      provider: "ollama",
      modelUsed: `ollama:${route.modelId ?? OLLAMA_MODEL}`,
      callJson: <T = unknown>(systemPrompt: string, userPrompt: string) =>
        callOllamaJson<T>(systemPrompt, userPrompt, route.modelId ?? OLLAMA_MODEL),
    };
  }

  if (route.provider === "blackbox") {
    return {
      provider: "blackbox",
      modelUsed: `blackbox:${route.modelId}`,
      callJson: <T = unknown>(systemPrompt: string, userPrompt: string) =>
        callBlackboxJson<T>(systemPrompt, userPrompt, route.modelId),
    };
  }

  return {
    provider: "anthropic",
    modelUsed: `anthropic:${route.modelId}`,
    callJson: <T = unknown>(systemPrompt: string, userPrompt: string) =>
      callSonnetJson<T>(systemPrompt, userPrompt, route.modelId),
  };
}

/**
 * Processes a single source document through the selected modes.
 * Creates library entry records for all extracted knowledge.
 */
export async function processSourceDocument(
  docId: string,
  text: string,
  modes: ProcessingMode[],
  batchId: string,
  initiativeSlug: string | null = null,
  options: ProcessingClientOptions = {}
): Promise<ProcessingResult> {
  let entriesCreated = 0;
  let trashRecommended = false;
  let conflictsDetected = 0;
  const baseTask: ProcessingTask =
    modes.includes("trash") && modes.length === 1
      ? "trash_detection"
      : "marketing_extraction";
  const client = buildProcessingClient(options, baseTask);

  try {
    updateSourceDocument(docId, { processingStatus: "processing" });

    const chunks = chunkText(text);
    if (chunks.length === 0) {
      updateSourceDocument(docId, {
        processingStatus: "processed",
        usefulnessScore: 0,
        trashRecommendation: true,
        trashReason: "File produced no extractable text",
      });
      return {
        success: true,
        entriesCreated: 0,
        trashRecommended: true,
        conflictsDetected: 0,
      };
    }

    // ── Trash detection (runs first to short-circuit if clearly useless) ──
    if (modes.includes("trash")) {
      const trashResult = await runTrashDetection(chunks, docId, client);
      trashRecommended = trashResult.recommended;

      if (trashRecommended) {
        // If clearly trash, skip other modes
        updateSourceDocument(docId, {
          processingStatus: "processed",
          usefulnessScore: trashResult.avgMemoryValue,
          trashRecommendation: true,
          trashReason: trashResult.reason,
        });

        await updateImportBatch(batchId, {
          trashCandidates: 1,
        } as never);

        return {
          success: true,
          entriesCreated: 0,
          trashRecommended: true,
          conflictsDetected: 0,
        };
      }
    }

    // Load existing approved canon once (used by conflict detector)
    const existingCanon = modes.includes("canon") ? listApprovedCanon() : [];

    const extractionModes = modes.filter(
      (mode): mode is ExtractionMode =>
        mode === "canon" || mode === "marketing" || mode === "internal"
    );

    // ── Process each chunk through selected extraction modes ──────────────
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      const sourceLocation = `chunk ${chunkIndex + 1} of ${chunks.length}`;

      if (extractionModes.length > 0) {
        const count = await runCombinedExtraction(
          chunk,
          docId,
          batchId,
          sourceLocation,
          existingCanon,
          client,
          initiativeSlug,
          extractionModes
        );
        entriesCreated += count.entries;
        conflictsDetected += count.conflicts;
      }
    }

    // ── Compute overall usefulness score ─────────────────────────────────
    const usefulnessScore = Math.min(
      100,
      (entriesCreated / Math.max(chunks.length, 1)) * 60 +
        (conflictsDetected === 0 ? 20 : 0) +
        20
    );

    updateSourceDocument(docId, {
      processingStatus: "processed",
      usefulnessScore,
      trashRecommendation: false,
    });

    return {
      success: true,
      entriesCreated,
      trashRecommended: false,
      conflictsDetected,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    updateSourceDocument(docId, {
      processingStatus: "failed",
      errorMessage: message,
    });
    return {
      success: false,
      entriesCreated,
      trashRecommended,
      conflictsDetected,
      error: message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual mode runners
// ─────────────────────────────────────────────────────────────────────────────

async function runTrashDetection(
  chunks: string[],
  _docId: string,
  client: ProcessingClient
): Promise<{ recommended: boolean; reason: string; avgMemoryValue: number }> {
  const sampleIndexes = chunks.length <= 3
    ? chunks.map((_, index) => index)
    : [0, Math.floor(chunks.length / 2), chunks.length - 1];
  const samples = sampleIndexes.map((index) => ({
    index,
    text: chunks[index].slice(0, 4_000),
  }));

  try {
    const { systemPrompt, userPrompt } = buildTrashDetectionBatchPrompt(samples);
    const result = await client.callJson<TrashDetectionBatchResult>(systemPrompt, userPrompt);

    return {
      recommended: result.recommendation === "trash",
      reason: result.reason || "Low information density",
      avgMemoryValue: result.memoryValueScore ?? 50,
    };
  } catch {
    // If LLM call fails, default to keep.
    return {
      recommended: false,
      reason: "Trash detection failed; defaulted to keep",
      avgMemoryValue: 50,
    };
  }
}

async function runCombinedExtraction(
  chunk: string,
  docId: string,
  batchId: string,
  sourceLocation: string,
  existingCanon: Awaited<ReturnType<typeof listApprovedCanon>>,
  client: ProcessingClient,
  initiativeSlug: string | null = null,
  extractionModes: ExtractionMode[] = ["canon"]
): Promise<{ entries: number; conflicts: number }> {
  const { systemPrompt, userPrompt } = buildCombinedExtractionPrompt(chunk, extractionModes);

  const extractionClient = buildProcessingClient(
    {
      useOllama: client.provider === "ollama",
      useBlackbox: client.provider === "blackbox",
    },
    resolveTaskForModes(extractionModes)
  );

  let result: CombinedExtractionResult;
  try {
    result = await extractionClient.callJson<CombinedExtractionResult>(systemPrompt, userPrompt);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Combined extraction failed for ${sourceLocation}: ${message}`);
  }

  let entriesCreated = 0;
  let conflictsDetected = 0;

  if (extractionModes.includes("canon")) {
    for (const item of result.canon ?? []) {
      const created = await createCanonCandidate(
        item,
        docId,
        batchId,
        sourceLocation,
        existingCanon,
        client,
        initiativeSlug
      );
      entriesCreated += 1;
      conflictsDetected += created.conflicts;
    }
  }

  if (extractionModes.includes("marketing")) {
    for (const item of result.marketing ?? []) {
      createMarketingCandidate(
        item,
        docId,
        batchId,
        sourceLocation,
        extractionClient,
        initiativeSlug
      );
      entriesCreated += 1;
    }
  }

  if (extractionModes.includes("internal")) {
    for (const item of result.internal ?? []) {
      createInternalCandidate(
        item,
        docId,
        batchId,
        sourceLocation,
        extractionClient,
        initiativeSlug
      );
      entriesCreated += 1;
    }
  }

  if (entriesCreated === 0 && (client.provider === "ollama" || client.provider === "blackbox")) {
    return runIndividualExtractionFallback(
      chunk,
      docId,
      batchId,
      sourceLocation,
      existingCanon,
      client,
      initiativeSlug,
      extractionModes
    );
  }

  return { entries: entriesCreated, conflicts: conflictsDetected };
}

async function runIndividualExtractionFallback(
  chunk: string,
  docId: string,
  batchId: string,
  sourceLocation: string,
  existingCanon: Awaited<ReturnType<typeof listApprovedCanon>>,
  client: ProcessingClient,
  initiativeSlug: string | null,
  extractionModes: ExtractionMode[]
): Promise<{ entries: number; conflicts: number }> {
  let entriesCreated = 0;
  let conflictsDetected = 0;

  if (extractionModes.includes("canon")) {
    const { systemPrompt, userPrompt } = buildCanonExtractionPrompt(chunk);
    const result = await client.callJson<CanonExtractionResult>(systemPrompt, userPrompt);
    for (const item of result.entries ?? []) {
      const created = await createCanonCandidate(
        item,
        docId,
        batchId,
        sourceLocation,
        existingCanon,
        client,
        initiativeSlug
      );
      entriesCreated += 1;
      conflictsDetected += created.conflicts;
    }
  }

  if (extractionModes.includes("marketing")) {
    const { systemPrompt, userPrompt } = buildMarketingNuggetPrompt(chunk);
    const result = await client.callJson<MarketingNuggetResult>(systemPrompt, userPrompt);
    for (const item of result.entries ?? []) {
      createMarketingCandidate(item, docId, batchId, sourceLocation, client, initiativeSlug);
      entriesCreated += 1;
    }
  }

  if (extractionModes.includes("internal")) {
    const { systemPrompt, userPrompt } = buildInternalNotePrompt(chunk);
    const result = await client.callJson<InternalNoteResult>(systemPrompt, userPrompt);
    for (const item of result.entries ?? []) {
      createInternalCandidate(item, docId, batchId, sourceLocation, client, initiativeSlug);
      entriesCreated += 1;
    }
  }

  return { entries: entriesCreated, conflicts: conflictsDetected };
}

async function createCanonCandidate(
  item: CanonExtractionItem,
  docId: string,
  batchId: string,
  sourceLocation: string,
  existingCanon: Awaited<ReturnType<typeof listApprovedCanon>>,
  client: ProcessingClient,
  initiativeSlug: string | null = null
): Promise<{ conflicts: number }> {
    const memAdj = computeMemoryValueAdjustment(item.canonicalStatement ?? item.sourceQuote ?? "");
    const memoryValueScore = Math.min(
      100,
      Math.max(0, (item.memoryValueScore ?? 50) + memAdj)
    );

    const entry = createLibraryEntry({
      sourceDocumentId: docId,
      importBatchId: batchId,
      initiativeSlug,
      entryType: "canon",
      title: item.title ?? "Untitled Canon",
      content: item.canonicalStatement ?? item.sourceQuote ?? "",
      summary: item.summary ?? null,
      visibility: "private",
      status: "candidate",
      tags: item.tags ?? [],
      confidenceScore: item.confidenceScore ?? 0.5,
      memoryValueScore,
      publicSafe: item.publicSafe ?? false,
      sensitive: false,
      sourceQuote: item.sourceQuote ?? null,
      sourceLocation,
      modelUsed: client.modelUsed,
      canonCategory: item.canonCategory ?? "other",
      canonicalStatement: item.canonicalStatement ?? "",
      locked: false,
      conflictStatus: null,
      publicAutomationAllowed: false,
      copyText: null,
      suggestedChannel: null,
      suggestedUse: null,
      emotionalAngle: null,
      audience: null,
      approvedForAutomation: false,
      internalCategory: null,
      sensitivityLevel: null,
      whyItMatters: null,
      reviewPriority: null,
      reviewedBy: null,
      reviewedAt: null,
    });

    let conflictsDetected = 0;
    const likelyConflicts = findLikelyConflictCandidates(existingCanon, item);
    for (const existing of likelyConflicts) {

      try {
        const conflictPrompts = buildConflictDetectionPrompt(
          existing.canonicalStatement ?? existing.content,
          item.canonicalStatement ?? item.sourceQuote ?? ""
        );
        const conflictResult = await client.callJson<ConflictDetectionResult>(
          conflictPrompts.systemPrompt,
          conflictPrompts.userPrompt
        );

        if (conflictResult.conflicting) {
          createConflict({
            existingEntryId: existing.id,
            challengerEntryId: entry.id,
            conflictReason: conflictResult.conflictReason,
            severity: conflictResult.severity,
          });
          updateLibraryEntry(entry.id, { conflictStatus: "conflicted" });
          conflictsDetected++;
          break; // One conflict per new entry is enough to flag it
        }
      } catch {
        // Conflict detection failure is non-fatal
      }
    }

    return { conflicts: conflictsDetected };
}

function createMarketingCandidate(
  item: MarketingExtractionItem,
  docId: string,
  batchId: string,
  sourceLocation: string,
  client: ProcessingClient,
  initiativeSlug: string | null = null
): void {
    const memAdj = computeMemoryValueAdjustment(item.copyText ?? "");
    const memoryValueScore = Math.min(
      100,
      Math.max(0, (item.memoryValueScore ?? 50) + memAdj)
    );

    createLibraryEntry({
      sourceDocumentId: docId,
      importBatchId: batchId,
      initiativeSlug,
      entryType: "marketing_nugget",
      title: item.title ?? "Marketing Nugget",
      content: item.copyText ?? item.sourceQuote ?? "",
      summary: null,
      visibility: "private",
      status: "candidate",
      tags: [],
      confidenceScore: item.confidenceScore ?? 0.5,
      memoryValueScore,
      publicSafe: false,
      sensitive: false,
      sourceQuote: item.sourceQuote ?? null,
      sourceLocation,
      modelUsed: client.modelUsed,
      canonCategory: null,
      canonicalStatement: null,
      locked: false,
      conflictStatus: null,
      publicAutomationAllowed: false,
      copyText: item.copyText ?? null,
      suggestedChannel: item.suggestedChannel ?? null,
      suggestedUse: item.suggestedUse ?? null,
      emotionalAngle: item.emotionalAngle ?? null,
      audience: item.audience ?? null,
      approvedForAutomation: false,
      internalCategory: null,
      sensitivityLevel: null,
      whyItMatters: null,
      reviewPriority: null,
      reviewedBy: null,
      reviewedAt: null,
    });
}

function createInternalCandidate(
  item: InternalExtractionItem,
  docId: string,
  batchId: string,
  sourceLocation: string,
  client: ProcessingClient,
  initiativeSlug: string | null = null
): void {
    const memAdj = computeMemoryValueAdjustment(item.summary ?? "");
    const memoryValueScore = Math.min(
      100,
      Math.max(0, (item.memoryValueScore ?? 50) + memAdj)
    );

    const isSensitive =
      item.sensitivityLevel === "high" || item.sensitivityLevel === "critical";

    createLibraryEntry({
      sourceDocumentId: docId,
      importBatchId: batchId,
      initiativeSlug,
      entryType: "internal_note",
      title: item.title ?? "Internal Note",
      content: item.summary ?? item.sourceQuote ?? "",
      summary: item.summary ?? null,
      visibility: "internal",
      status: "candidate",
      tags: [],
      confidenceScore: item.confidenceScore ?? 0.5,
      memoryValueScore,
      publicSafe: false,
      sensitive: isSensitive,
      sourceQuote: item.sourceQuote ?? null,
      sourceLocation,
      modelUsed: client.modelUsed,
      canonCategory: null,
      canonicalStatement: null,
      locked: false,
      conflictStatus: null,
      publicAutomationAllowed: false,
      copyText: null,
      suggestedChannel: null,
      suggestedUse: null,
      emotionalAngle: null,
      audience: null,
      approvedForAutomation: false,
      internalCategory: item.internalCategory ?? null,
      sensitivityLevel: item.sensitivityLevel ?? null,
      whyItMatters: item.whyItMatters ?? null,
      reviewPriority: isSensitive ? "high" : "normal",
      reviewedBy: null,
      reviewedAt: null,
    });
}

function findLikelyConflictCandidates(
  existingCanon: Awaited<ReturnType<typeof listApprovedCanon>>,
  item: CanonExtractionItem
) {
  const candidateText = [item.title, item.canonicalStatement, item.sourceQuote, ...(item.tags ?? [])]
    .filter(Boolean)
    .join(" ");
  const candidateTerms = extractConflictTerms(candidateText);

  return existingCanon
    .filter((existing) => existing.canonCategory === item.canonCategory)
    .map((existing) => {
      const existingText = [
        existing.title,
        existing.canonicalStatement,
        existing.content,
        existing.sourceQuote,
        ...existing.tags,
      ]
        .filter(Boolean)
        .join(" ");
      const existingTerms = extractConflictTerms(existingText);
      const overlap = [...candidateTerms].filter((term) => existingTerms.has(term)).length;
      return { existing, overlap };
    })
    .filter(({ overlap }) => overlap > 0 || candidateTerms.size === 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, MAX_CONFLICT_CHECKS_PER_CANDIDATE)
    .map(({ existing }) => existing);
}

function extractConflictTerms(text: string): Set<string> {
  const stopWords = new Set([
    "about", "after", "also", "and", "are", "but", "can", "for", "from", "has",
    "have", "into", "not", "our", "the", "this", "that", "with", "you", "your",
  ]);

  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((term) => term.length >= 4 && !stopWords.has(term))
      .slice(0, 80)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public safety review (called from server actions)
// ─────────────────────────────────────────────────────────────────────────────

import { buildPublicSafetyPrompt, type PublicSafetyResult } from "@/lib/library/prompts";

/**
 * Runs a strong-model public-safety review on an entry's content.
 * Returns the safety result without mutating the entry — caller decides action.
 */
export async function runPublicSafetyReview(
  entryId: string,
  options: ProcessingClientOptions = {}
): Promise<PublicSafetyResult> {
  const entry = getLibraryEntry(entryId);
  if (!entry) throw new Error(`Entry ${entryId} not found`);
  const client = buildProcessingClient(options, "public_safety_review");

  const content = [
    entry.title,
    entry.canonicalStatement,
    entry.content,
    entry.copyText,
    entry.summary,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { systemPrompt, userPrompt } = buildPublicSafetyPrompt(content);
  return client.callJson<PublicSafetyResult>(systemPrompt, userPrompt);
}
