import "@/lib/brand-voice/db";

import { randomUUID } from "node:crypto";

import { db } from "@/lib/brand-voice/db";
import {
  assertBrandVoiceStatusTransition,
  buildBrandVoiceContext,
  isEligibleBrandVoiceLibraryEntry,
  toBrandVoiceVersionSummary,
} from "@/lib/brand-voice/service";
import type {
  BrandVoiceEvent,
  BrandVoiceGuidelineInput,
  BrandVoiceGuidelineRecord,
  BrandVoiceLibrarySourceOption,
  BrandVoiceStatus,
  BrandVoiceVersionSummary,
} from "@/lib/brand-voice/types";
import { listLibraryEntries } from "@/lib/library/repository";

type GuidelineRow = {
  id: string;
  initiative_slug: string;
  version_number: number;
  name: string;
  status: BrandVoiceStatus;
  source_materials_json: string;
  audience_summary: string;
  positioning_summary: string;
  tone_attributes_json: string;
  allowed_language_json: string;
  discouraged_language_json: string;
  claim_boundaries_json: string;
  example_pairs_json: string;
  channel_variations_json: string;
  notes: string;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
};

type EventRow = {
  id: string;
  guideline_id: string;
  initiative_slug: string;
  event_type: string;
  summary: string;
  detail_json: string;
  recorded_at: string;
};

function parseArray<T>(value: string): T[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function mapGuidelineRow(row: GuidelineRow): BrandVoiceGuidelineRecord {
  return {
    id: row.id,
    initiativeSlug: row.initiative_slug,
    versionNumber: row.version_number,
    name: row.name,
    status: row.status,
    sourceMaterials: parseArray(row.source_materials_json),
    audienceSummary: row.audience_summary,
    positioningSummary: row.positioning_summary,
    toneAttributes: parseArray(row.tone_attributes_json),
    allowedLanguage: parseArray(row.allowed_language_json),
    discouragedLanguage: parseArray(row.discouraged_language_json),
    claimBoundaries: parseArray(row.claim_boundaries_json),
    examplePairs: parseArray(row.example_pairs_json),
    channelVariations: parseArray(row.channel_variations_json),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approvedAt: row.approved_at ?? undefined,
  };
}

function mapEventRow(row: EventRow): BrandVoiceEvent {
  let detail: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(row.detail_json);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      detail = parsed as Record<string, unknown>;
    }
  } catch {
    detail = { parseError: "Stored event detail was not valid JSON." };
  }
  return {
    id: row.id,
    guidelineId: row.guideline_id,
    initiativeSlug: row.initiative_slug,
    eventType: row.event_type,
    summary: row.summary,
    detail,
    recordedAt: row.recorded_at,
  };
}

function toParams(
  id: string,
  initiativeSlug: string,
  versionNumber: number,
  input: BrandVoiceGuidelineInput,
  nowIso: string,
  approvedAt?: string
) {
  return {
    id,
    initiative_slug: initiativeSlug,
    version_number: versionNumber,
    name: input.name,
    status: input.status,
    source_materials_json: JSON.stringify(input.sourceMaterials),
    audience_summary: input.audienceSummary,
    positioning_summary: input.positioningSummary,
    tone_attributes_json: JSON.stringify(input.toneAttributes),
    allowed_language_json: JSON.stringify(input.allowedLanguage),
    discouraged_language_json: JSON.stringify(input.discouragedLanguage),
    claim_boundaries_json: JSON.stringify(input.claimBoundaries),
    example_pairs_json: JSON.stringify(input.examplePairs),
    channel_variations_json: JSON.stringify(input.channelVariations),
    notes: input.notes,
    created_at: nowIso,
    updated_at: nowIso,
    approved_at: approvedAt ?? null,
  };
}

function recordEvent(input: {
  guidelineId: string;
  initiativeSlug: string;
  eventType: string;
  summary: string;
  detail?: Record<string, unknown>;
  nowIso: string;
}) {
  db.prepare(
    `
      INSERT INTO brand_voice_events
        (id, guideline_id, initiative_slug, event_type, summary, detail_json, recorded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    randomUUID(),
    input.guidelineId,
    input.initiativeSlug,
    input.eventType,
    input.summary,
    JSON.stringify(input.detail ?? {}),
    input.nowIso
  );
}

export function listBrandVoiceGuidelines(initiativeSlug: string): BrandVoiceGuidelineRecord[] {
  const rows = db
    .prepare(
      `SELECT * FROM brand_voice_guidelines WHERE initiative_slug = ? ORDER BY version_number DESC`
    )
    .all(initiativeSlug) as GuidelineRow[];
  return rows.map(mapGuidelineRow);
}

export function getBrandVoiceGuideline(id: string): BrandVoiceGuidelineRecord | undefined {
  const row = db
    .prepare(`SELECT * FROM brand_voice_guidelines WHERE id = ?`)
    .get(id) as GuidelineRow | undefined;
  return row ? mapGuidelineRow(row) : undefined;
}

export function getApprovedBrandVoiceGuideline(
  initiativeSlug: string
): BrandVoiceGuidelineRecord | undefined {
  const row = db
    .prepare(
      `SELECT * FROM brand_voice_guidelines WHERE initiative_slug = ? AND status = 'approved' ORDER BY version_number DESC LIMIT 1`
    )
    .get(initiativeSlug) as GuidelineRow | undefined;
  return row ? mapGuidelineRow(row) : undefined;
}

export function listApprovedBrandVoiceVersions(
  initiativeSlug: string,
  includeSuperseded = false
): BrandVoiceVersionSummary[] {
  return listBrandVoiceGuidelines(initiativeSlug)
    .filter(
      (guideline) =>
        guideline.status === "approved" || (includeSuperseded && guideline.status === "superseded")
    )
    .map(toBrandVoiceVersionSummary);
}

export function getApprovedBrandVoiceContext(initiativeSlug: string): string | undefined {
  const guideline = getApprovedBrandVoiceGuideline(initiativeSlug);
  return guideline ? buildBrandVoiceContext(guideline) : undefined;
}

export function createBrandVoiceGuideline(
  initiativeSlug: string,
  input: BrandVoiceGuidelineInput
): BrandVoiceGuidelineRecord {
  if (input.status !== "draft") {
    throw new Error("New brand voice versions must begin as drafts.");
  }
  const nowIso = new Date().toISOString();
  const id = randomUUID();
  let versionNumber = 0;

  db.transaction(() => {
    const maxVersion = (
      db
        .prepare(
          `SELECT COALESCE(MAX(version_number), 0) AS version_number FROM brand_voice_guidelines WHERE initiative_slug = ?`
        )
        .get(initiativeSlug) as { version_number: number }
    ).version_number;
    versionNumber = maxVersion + 1;
    db.prepare(
      `
        INSERT INTO brand_voice_guidelines (
          id, initiative_slug, version_number, name, status, source_materials_json,
          audience_summary, positioning_summary, tone_attributes_json, allowed_language_json,
          discouraged_language_json, claim_boundaries_json, example_pairs_json,
          channel_variations_json, notes, created_at, updated_at, approved_at
        ) VALUES (
          @id, @initiative_slug, @version_number, @name, @status, @source_materials_json,
          @audience_summary, @positioning_summary, @tone_attributes_json, @allowed_language_json,
          @discouraged_language_json, @claim_boundaries_json, @example_pairs_json,
          @channel_variations_json, @notes, @created_at, @updated_at, @approved_at
        )
      `
    ).run(toParams(id, initiativeSlug, versionNumber, input, nowIso));
    recordEvent({
      guidelineId: id,
      initiativeSlug,
      eventType: "brand-voice.version-created",
      summary: `MarketOps created brand voice version ${versionNumber} as ${input.status}.`,
      detail: { versionNumber, status: input.status },
      nowIso,
    });
  })();

  return getBrandVoiceGuideline(id)!;
}

function changedFields(existing: BrandVoiceGuidelineRecord, input: BrandVoiceGuidelineInput) {
  return (Object.keys(input) as Array<keyof BrandVoiceGuidelineInput>).filter((key) =>
    typeof input[key] === "object"
      ? JSON.stringify(existing[key]) !== JSON.stringify(input[key])
      : existing[key] !== input[key]
  );
}

export function updateBrandVoiceGuideline(
  id: string,
  input: BrandVoiceGuidelineInput
): BrandVoiceGuidelineRecord {
  const existing = getBrandVoiceGuideline(id);
  if (!existing) throw new Error("Brand voice version not found.");
  if (existing.status === "approved" || existing.status === "superseded") {
    throw new Error("Approved and superseded brand voice versions are immutable. Create a new version.");
  }
  assertBrandVoiceStatusTransition(existing.status, input.status);

  const nowIso = new Date().toISOString();
  const fields = changedFields(existing, input);

  db.transaction(() => {
    if (input.status === "approved") {
      const priorApproved = db
        .prepare(
          `SELECT * FROM brand_voice_guidelines WHERE initiative_slug = ? AND status = 'approved' AND id <> ?`
        )
        .all(existing.initiativeSlug, id) as GuidelineRow[];
      db.prepare(
        `UPDATE brand_voice_guidelines SET status = 'superseded', updated_at = ? WHERE initiative_slug = ? AND status = 'approved' AND id <> ?`
      ).run(nowIso, existing.initiativeSlug, id);
      for (const prior of priorApproved) {
        recordEvent({
          guidelineId: prior.id,
          initiativeSlug: existing.initiativeSlug,
          eventType: "brand-voice.version-superseded",
          summary: `Version ${prior.version_number} was superseded by version ${existing.versionNumber}.`,
          detail: { supersededById: id, supersededByVersion: existing.versionNumber },
          nowIso,
        });
      }
    }

    const params = toParams(
      id,
      existing.initiativeSlug,
      existing.versionNumber,
      input,
      nowIso,
      input.status === "approved" ? nowIso : undefined
    );
    db.prepare(
      `
        UPDATE brand_voice_guidelines SET
          name = @name,
          status = @status,
          source_materials_json = @source_materials_json,
          audience_summary = @audience_summary,
          positioning_summary = @positioning_summary,
          tone_attributes_json = @tone_attributes_json,
          allowed_language_json = @allowed_language_json,
          discouraged_language_json = @discouraged_language_json,
          claim_boundaries_json = @claim_boundaries_json,
          example_pairs_json = @example_pairs_json,
          channel_variations_json = @channel_variations_json,
          notes = @notes,
          updated_at = @updated_at,
          approved_at = @approved_at
        WHERE id = @id
      `
    ).run(params);

    if (fields.length > 0) {
      recordEvent({
        guidelineId: id,
        initiativeSlug: existing.initiativeSlug,
        eventType:
          existing.status === input.status
            ? "brand-voice.version-updated"
            : "brand-voice.status-changed",
        summary:
          existing.status === input.status
            ? `MarketOps updated brand voice version ${existing.versionNumber}.`
            : `Brand voice version ${existing.versionNumber} moved from ${existing.status} to ${input.status}.`,
        detail: { changedFields: fields, previousStatus: existing.status, status: input.status },
        nowIso,
      });
    }
  })();

  return getBrandVoiceGuideline(id)!;
}

export function listBrandVoiceEvents(guidelineId: string): BrandVoiceEvent[] {
  const rows = db
    .prepare(
      `SELECT * FROM brand_voice_events WHERE guideline_id = ? ORDER BY recorded_at DESC, id DESC`
    )
    .all(guidelineId) as EventRow[];
  return rows.map(mapEventRow);
}

export function listEligibleBrandVoiceLibrarySources(
  initiativeSlug: string
): BrandVoiceLibrarySourceOption[] {
  return listLibraryEntries({ initiativeSlug })
    .filter(isEligibleBrandVoiceLibraryEntry)
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      entryType: entry.entryType,
      status: entry.status,
      sourceLocation: entry.sourceLocation ?? undefined,
    }));
}

export function purgeBrandVoiceData(initiativeSlug?: string) {
  if (initiativeSlug) {
    const ids = (
      db
        .prepare(`SELECT id FROM brand_voice_guidelines WHERE initiative_slug = ?`)
        .all(initiativeSlug) as Array<{ id: string }>
    ).map((row) => row.id);
    for (const id of ids) {
      db.prepare(`DELETE FROM brand_voice_events WHERE guideline_id = ?`).run(id);
    }
    db.prepare(`DELETE FROM brand_voice_guidelines WHERE initiative_slug = ?`).run(initiativeSlug);
    return;
  }
  db.prepare(`DELETE FROM brand_voice_events`).run();
  db.prepare(`DELETE FROM brand_voice_guidelines`).run();
}
