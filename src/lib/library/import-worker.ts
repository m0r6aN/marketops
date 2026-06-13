import { processSourceDocument } from "@/lib/library/processor";
import {
  listSourceDocumentsByBatch,
  updateImportBatch,
} from "@/lib/library/repository";
import type { ProcessingMode } from "@/lib/library/types";

type ImportWorkerJob = {
  batchId: string;
  modes: ProcessingMode[];
  initiativeSlug: string | null;
  useOllama: boolean;
  useBlackbox?: boolean;
};

let queue: Promise<void> = Promise.resolve();
const activeBatches = new Set<string>();

export function enqueueImportBatch(job: ImportWorkerJob) {
  if (activeBatches.has(job.batchId)) return;
  activeBatches.add(job.batchId);

  queue = queue
    .then(() => processImportBatch(job))
    .catch((error) => {
      console.error("[Library Import Worker]", error);
      updateImportBatch(job.batchId, {
        status: "failed",
        completedAt: new Date().toISOString(),
        summary: error instanceof Error ? error.message : "Import worker failed",
      });
    })
    .finally(() => {
      activeBatches.delete(job.batchId);
    });

  void queue;
}

async function processImportBatch(job: ImportWorkerJob) {
  const docs = listSourceDocumentsByBatch(job.batchId);
  let processedFiles = 0;
  let failedFiles = 0;
  let totalEntries = 0;
  let totalTrashCandidates = 0;
  let totalConflicts = 0;

  const providerLabel = job.useOllama ? "Ollama" : job.useBlackbox ? "Blackbox" : "Claude";
  updateImportBatch(job.batchId, {
    status: "processing",
    totalFiles: docs.length,
    startedAt: new Date().toISOString(),
    summary: `Queued ${docs.length} file(s) for ${providerLabel} processing.`,
  });

  for (const doc of docs) {
    if (doc.processingStatus === "failed" || !doc.rawText) {
      failedFiles++;
    } else {
      const result = await processSourceDocument(
        doc.id,
        doc.rawText,
        job.modes,
        job.batchId,
        job.initiativeSlug,
        { useOllama: job.useOllama, useBlackbox: job.useBlackbox }
      );

      if (result.success) {
        processedFiles++;
        totalEntries += result.entriesCreated;
        if (result.trashRecommended) totalTrashCandidates++;
        totalConflicts += result.conflictsDetected;
      } else {
        failedFiles++;
      }
    }

    updateImportBatch(job.batchId, {
      status: "processing",
      processedFiles,
      failedFiles,
      entriesExtracted: totalEntries,
      trashCandidates: totalTrashCandidates,
      conflictsDetected: totalConflicts,
      summary:
        `Processed ${processedFiles + failedFiles} of ${docs.length} file(s) with ${providerLabel}. ` +
        `Extracted ${totalEntries} entries. ${totalConflicts} conflict(s) detected.`,
    });
  }

  updateImportBatch(job.batchId, {
    status: "completed",
    processedFiles,
    failedFiles,
    entriesExtracted: totalEntries,
    trashCandidates: totalTrashCandidates,
    conflictsDetected: totalConflicts,
    completedAt: new Date().toISOString(),
    summary:
      `Processed ${processedFiles} file(s) with ${providerLabel}. ` +
      `Extracted ${totalEntries} entries. ${totalConflicts} conflict(s) detected.`,
  });
}
