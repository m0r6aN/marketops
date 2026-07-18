import "@/lib/customer-finder/db";

import { randomUUID } from "node:crypto";

import { db } from "@/lib/customer-finder/db";
import { buildDedupeKey } from "@/lib/customer-finder/service";
import type {
  DiscoveredCandidate,
  DiscoveryCampaignDetail,
  DiscoveryCampaignRecord,
  DiscoverySourceRun,
  OutreachDraftRecord,
  OutreachChannel,
} from "@/lib/customer-finder/types";

type CampaignRow = {
  id: string;
  slug: string;
  campaign_name: string;
  initiative_slug: string;
  origin_prompt: string;
  target_description: string;
  normalized_target_description: string;
  status: string;
  discovery_status: string;
  selected_channels: string;
  request_fingerprint: string;
  provenance_json: string;
  created_at: string;
  updated_at: string;
  retention_expires_at: string;
  last_processed_at: string | null;
  notes: string | null;
};

type SourceRunRow = {
  source_id: string;
  source_label: string;
  support_level: string;
  selected: number;
  processing_status: string;
  rationale: string;
  availability_note: string | null;
  input_text: string | null;
  result_count: number;
  error_message: string | null;
  processed_at: string | null;
};

type CandidateRow = {
  id: string;
  campaign_id: string;
  dedupe_key: string;
  candidate_kind: string;
  display_name: string;
  organization_name: string | null;
  source_summary: string;
  match_reason: string;
  verified_evidence: string;
  confidence_label: string;
  confidence_score: number;
  contact_channel: string | null;
  contact_value: string | null;
  factual_status: "verified";
  inferred_notes: string | null;
  discovery_timestamp: string;
  created_at: string;
  updated_at: string;
};

type CandidateProvenanceRow = {
  candidate_id: string;
  source_id: string;
  source_label: string;
  source_url: string | null;
  reason: string;
  evidence_text: string;
  confidence_score: number;
  contact_channel: string | null;
  contact_value: string | null;
  discovered_at: string;
};

type DraftRow = {
  id: string;
  campaign_id: string;
  candidate_id: string;
  channel: string;
  subject_line: string | null;
  message_body: string;
  approval_status: "review-required" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
};

function mapCampaignRow(row: CampaignRow): DiscoveryCampaignRecord {
  return {
    id: row.id,
    slug: row.slug,
    campaignName: row.campaign_name,
    initiativeSlug: row.initiative_slug,
    originPrompt: row.origin_prompt,
    targetDescription: row.target_description,
    normalizedTargetDescription: row.normalized_target_description,
    status: row.status,
    discoveryStatus: row.discovery_status,
    selectedChannels: JSON.parse(row.selected_channels) as OutreachChannel[],
    requestFingerprint: row.request_fingerprint,
    provenance: JSON.parse(row.provenance_json) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    retentionExpiresAt: row.retention_expires_at,
    lastProcessedAt: row.last_processed_at ?? undefined,
    notes: row.notes ?? undefined,
  };
}

function mapSourceRunRow(row: SourceRunRow): DiscoverySourceRun {
  return {
    sourceId: row.source_id as DiscoverySourceRun["sourceId"],
    sourceLabel: row.source_label,
    supportLevel: row.support_level as DiscoverySourceRun["supportLevel"],
    selected: Boolean(row.selected),
    processingStatus: row.processing_status as DiscoverySourceRun["processingStatus"],
    rationale: row.rationale,
    availabilityNote: row.availability_note ?? undefined,
    inputText: row.input_text ?? undefined,
    resultCount: row.result_count,
    errorMessage: row.error_message ?? undefined,
    processedAt: row.processed_at ?? undefined,
  };
}

function mapDraftRow(row: DraftRow): OutreachDraftRecord {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    candidateId: row.candidate_id,
    channel: row.channel as OutreachChannel,
    subjectLine: row.subject_line ?? undefined,
    messageBody: row.message_body,
    approvalStatus: row.approval_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function purgeExpiredCustomerFinderData(nowIso = new Date().toISOString()) {
  const expiredIds = (
    db
      .prepare(`SELECT id FROM customer_finder_campaigns WHERE retention_expires_at <= ?`)
      .all(nowIso) as Array<{ id: string }>
  ).map((row) => row.id);

  for (const campaignId of expiredIds) {
    const candidateIds = (
      db
        .prepare(`SELECT id FROM customer_finder_candidates WHERE campaign_id = ?`)
        .all(campaignId) as Array<{ id: string }>
    ).map((row) => row.id);

    for (const candidateId of candidateIds) {
      db.prepare(`DELETE FROM customer_finder_candidate_provenance WHERE candidate_id = ?`).run(
        candidateId
      );
      db.prepare(`DELETE FROM customer_finder_outreach_drafts WHERE candidate_id = ?`).run(candidateId);
    }

    db.prepare(`DELETE FROM customer_finder_candidates WHERE campaign_id = ?`).run(campaignId);
    db.prepare(`DELETE FROM customer_finder_source_runs WHERE campaign_id = ?`).run(campaignId);
    db.prepare(`DELETE FROM customer_finder_events WHERE campaign_id = ?`).run(campaignId);
    db.prepare(`DELETE FROM customer_finder_outreach_drafts WHERE campaign_id = ?`).run(campaignId);
    db.prepare(`DELETE FROM customer_finder_campaigns WHERE id = ?`).run(campaignId);
  }

  return expiredIds.length;
}

export function purgeAllCustomerFinderData() {
  const campaignIds = (
    db.prepare(`SELECT id FROM customer_finder_campaigns`).all() as Array<{ id: string }>
  ).map((row) => row.id);

  for (const campaignId of campaignIds) {
    const candidateIds = (
      db
        .prepare(`SELECT id FROM customer_finder_candidates WHERE campaign_id = ?`)
        .all(campaignId) as Array<{ id: string }>
    ).map((row) => row.id);

    for (const candidateId of candidateIds) {
      db.prepare(`DELETE FROM customer_finder_candidate_provenance WHERE candidate_id = ?`).run(
        candidateId
      );
    }

    db.prepare(`DELETE FROM customer_finder_candidates WHERE campaign_id = ?`).run(campaignId);
    db.prepare(`DELETE FROM customer_finder_source_runs WHERE campaign_id = ?`).run(campaignId);
    db.prepare(`DELETE FROM customer_finder_outreach_drafts WHERE campaign_id = ?`).run(campaignId);
    db.prepare(`DELETE FROM customer_finder_events WHERE campaign_id = ?`).run(campaignId);
  }

  db.prepare(`DELETE FROM customer_finder_campaigns`).run();
}

export function createDiscoveryCampaignRecord(input: {
  id: string;
  slug: string;
  campaignName: string;
  initiativeSlug: string;
  originPrompt: string;
  targetDescription: string;
  normalizedTargetDescription: string;
  requestFingerprint: string;
  provenance: Record<string, unknown>;
  createdAt: string;
  retentionExpiresAt: string;
  selectedChannels?: OutreachChannel[];
}) {
  db.prepare(
    `
      INSERT INTO customer_finder_campaigns (
        id,
        slug,
        campaign_name,
        initiative_slug,
        origin_prompt,
        target_description,
        normalized_target_description,
        status,
        discovery_status,
        selected_channels,
        request_fingerprint,
        provenance_json,
        created_at,
        updated_at,
        retention_expires_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'planning', 'pending', ?, ?, ?, ?, ?, ?)
    `
  ).run(
    input.id,
    input.slug,
    input.campaignName,
    input.initiativeSlug,
    input.originPrompt,
    input.targetDescription,
    input.normalizedTargetDescription,
    JSON.stringify(input.selectedChannels ?? []),
    input.requestFingerprint,
    JSON.stringify(input.provenance),
    input.createdAt,
    input.createdAt,
    input.retentionExpiresAt
  );
}

export function findDiscoveryCampaignByFingerprint(requestFingerprint: string) {
  const row = db
    .prepare(`SELECT * FROM customer_finder_campaigns WHERE request_fingerprint = ?`)
    .get(requestFingerprint) as CampaignRow | undefined;

  return row ? mapCampaignRow(row) : undefined;
}

export function listDiscoveryCampaigns() {
  const rows = db
    .prepare(`SELECT * FROM customer_finder_campaigns ORDER BY created_at DESC`)
    .all() as CampaignRow[];
  return rows.map(mapCampaignRow);
}

export function getDiscoveryCampaignRecord(campaignId: string) {
  const row = db
    .prepare(`SELECT * FROM customer_finder_campaigns WHERE id = ?`)
    .get(campaignId) as CampaignRow | undefined;
  return row ? mapCampaignRow(row) : undefined;
}

export function saveSourceRun(campaignId: string, sourceRun: DiscoverySourceRun, nowIso: string) {
  db.prepare(
    `
      INSERT INTO customer_finder_source_runs (
        id,
        campaign_id,
        source_id,
        source_label,
        support_level,
        selected,
        processing_status,
        rationale,
        availability_note,
        input_text,
        result_count,
        error_message,
        processed_at,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(campaign_id, source_id)
      DO UPDATE SET
        source_label = excluded.source_label,
        support_level = excluded.support_level,
        selected = excluded.selected,
        processing_status = excluded.processing_status,
        rationale = excluded.rationale,
        availability_note = excluded.availability_note,
        input_text = excluded.input_text,
        result_count = excluded.result_count,
        error_message = excluded.error_message,
        processed_at = excluded.processed_at,
        updated_at = excluded.updated_at
    `
  ).run(
    randomUUID(),
    campaignId,
    sourceRun.sourceId,
    sourceRun.sourceLabel,
    sourceRun.supportLevel,
    sourceRun.selected ? 1 : 0,
    sourceRun.processingStatus,
    sourceRun.rationale,
    sourceRun.availabilityNote ?? null,
    sourceRun.inputText ?? null,
    sourceRun.resultCount,
    sourceRun.errorMessage ?? null,
    sourceRun.processedAt ?? null,
    nowIso,
    nowIso
  );
}

export function listSourceRunsForCampaign(campaignId: string) {
  const rows = db
    .prepare(
      `
        SELECT source_id, source_label, support_level, selected, processing_status, rationale,
               availability_note, input_text, result_count, error_message, processed_at
        FROM customer_finder_source_runs
        WHERE campaign_id = ?
        ORDER BY selected DESC, source_label ASC
      `
    )
    .all(campaignId) as SourceRunRow[];

  return rows.map(mapSourceRunRow);
}

export function updateCampaignProcessingState(input: {
  campaignId: string;
  status?: string;
  discoveryStatus?: string;
  notes?: string;
  lastProcessedAt?: string;
}) {
  const fields: string[] = [];
  const values: Array<string | null> = [];

  if (input.status !== undefined) {
    fields.push("status = ?");
    values.push(input.status);
  }
  if (input.discoveryStatus !== undefined) {
    fields.push("discovery_status = ?");
    values.push(input.discoveryStatus);
  }
  if (input.notes !== undefined) {
    fields.push("notes = ?");
    values.push(input.notes);
  }
  if (input.lastProcessedAt !== undefined) {
    fields.push("last_processed_at = ?");
    values.push(input.lastProcessedAt);
  }

  fields.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(input.campaignId);

  db.prepare(
    `UPDATE customer_finder_campaigns SET ${fields.join(", ")} WHERE id = ?`
  ).run(...values);
}

export function replaceCampaignCandidates(campaignId: string, candidates: DiscoveredCandidate[], nowIso: string) {
  const existingCandidateIds = (
    db
      .prepare(`SELECT id FROM customer_finder_candidates WHERE campaign_id = ?`)
      .all(campaignId) as Array<{ id: string }>
  ).map((row) => row.id);

  for (const candidateId of existingCandidateIds) {
    db.prepare(`DELETE FROM customer_finder_candidate_provenance WHERE candidate_id = ?`).run(candidateId);
    db.prepare(`DELETE FROM customer_finder_outreach_drafts WHERE candidate_id = ?`).run(candidateId);
  }
  db.prepare(`DELETE FROM customer_finder_candidates WHERE campaign_id = ?`).run(campaignId);

  for (const candidate of candidates) {
    const candidateId = randomUUID();
    const dedupeKey = buildDedupeKey(candidate);
    db.prepare(
      `
        INSERT INTO customer_finder_candidates (
          id,
          campaign_id,
          dedupe_key,
          candidate_kind,
          display_name,
          organization_name,
          source_summary,
          match_reason,
          verified_evidence,
          confidence_label,
          confidence_score,
          contact_channel,
          contact_value,
          factual_status,
          inferred_notes,
          discovery_timestamp,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified', ?, ?, ?, ?)
      `
    ).run(
      candidateId,
      campaignId,
      dedupeKey,
      candidate.candidateKind,
      candidate.displayName,
      candidate.organizationName ?? null,
      candidate.sourceSummary ?? "",
      candidate.matchReason,
      candidate.verifiedEvidence,
      candidate.confidenceLabel,
      candidate.confidenceScore,
      candidate.contactChannel ?? null,
      candidate.contactValue ?? null,
      candidate.inferredNotes ?? null,
      candidate.discoveryTimestamp,
      nowIso,
      nowIso
    );

    for (const provenance of candidate.provenance) {
      db.prepare(
        `
          INSERT INTO customer_finder_candidate_provenance (
            id,
            candidate_id,
            source_id,
            source_label,
            source_url,
            reason,
            evidence_text,
            confidence_score,
            contact_channel,
            contact_value,
            discovered_at,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      ).run(
        randomUUID(),
        candidateId,
        provenance.sourceId,
        provenance.sourceLabel,
        provenance.sourceUrl ?? null,
        provenance.reason,
        provenance.evidenceText,
        provenance.confidenceScore,
        provenance.contactChannel ?? null,
        provenance.contactValue ?? null,
        provenance.discoveredAt,
        nowIso
      );
    }
  }
}

export function listCandidateRecordsForCampaign(campaignId: string): DiscoveryCampaignDetail["candidates"] {
  const rows = db
    .prepare(
      `
        SELECT * FROM customer_finder_candidates
        WHERE campaign_id = ?
        ORDER BY confidence_score DESC, display_name ASC
      `
    )
    .all(campaignId) as CandidateRow[];

  const provenanceRows = db
    .prepare(
      `
        SELECT candidate_id, source_id, source_label, source_url, reason, evidence_text,
               confidence_score, contact_channel, contact_value, discovered_at
        FROM customer_finder_candidate_provenance
        WHERE candidate_id IN (
          SELECT id FROM customer_finder_candidates WHERE campaign_id = ?
        )
        ORDER BY discovered_at ASC
      `
    )
    .all(campaignId) as CandidateProvenanceRow[];

  const provenanceByCandidateId = provenanceRows.reduce(
    (map, row) => {
      const existing = map.get(row.candidate_id) ?? [];
      existing.push({
        sourceId: row.source_id as DiscoveredCandidate["provenance"][number]["sourceId"],
        sourceLabel: row.source_label,
        sourceUrl: row.source_url ?? undefined,
        reason: row.reason,
        evidenceText: row.evidence_text,
        confidenceScore: row.confidence_score,
        contactChannel: row.contact_channel ?? undefined,
        contactValue: row.contact_value ?? undefined,
        discoveredAt: row.discovered_at,
      });
      map.set(row.candidate_id, existing);
      return map;
    },
    new Map<string, DiscoveredCandidate["provenance"]>()
  );

  return rows.map((row) => ({
    id: row.id,
    dedupeKey: row.dedupe_key,
    candidateKind: row.candidate_kind as DiscoveredCandidate["candidateKind"],
    displayName: row.display_name,
    organizationName: row.organization_name ?? undefined,
    sourceSummary: row.source_summary,
    matchReason: row.match_reason,
    verifiedEvidence: row.verified_evidence,
    confidenceLabel: row.confidence_label as DiscoveredCandidate["confidenceLabel"],
    confidenceScore: row.confidence_score,
    contactChannel: row.contact_channel ?? undefined,
    contactValue: row.contact_value ?? undefined,
    factualStatus: row.factual_status,
    inferredNotes: row.inferred_notes ?? undefined,
    discoveryTimestamp: row.discovery_timestamp,
    provenance: provenanceByCandidateId.get(row.id) ?? [],
  }));
}

export function saveOutreachDraft(input: {
  campaignId: string;
  candidateId: string;
  channel: OutreachChannel;
  subjectLine?: string;
  messageBody: string;
  approvalStatus: "review-required" | "approved" | "rejected";
  nowIso: string;
}) {
  db.prepare(
    `
      INSERT INTO customer_finder_outreach_drafts (
        id,
        campaign_id,
        candidate_id,
        channel,
        subject_line,
        message_body,
        approval_status,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    randomUUID(),
    input.campaignId,
    input.candidateId,
    input.channel,
    input.subjectLine ?? null,
    input.messageBody,
    input.approvalStatus,
    input.nowIso,
    input.nowIso
  );
}

export function listOutreachDraftsForCampaign(campaignId: string) {
  const rows = db
    .prepare(
      `SELECT * FROM customer_finder_outreach_drafts WHERE campaign_id = ? ORDER BY created_at DESC`
    )
    .all(campaignId) as DraftRow[];
  return rows.map(mapDraftRow);
}

export function recordCustomerFinderEvent(input: {
  campaignId: string;
  eventType: string;
  summary: string;
  detail?: Record<string, unknown>;
  nowIso: string;
}) {
  db.prepare(
    `
      INSERT INTO customer_finder_events (id, campaign_id, event_type, summary, detail_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `
  ).run(
    randomUUID(),
    input.campaignId,
    input.eventType,
    input.summary,
    JSON.stringify(input.detail ?? {}),
    input.nowIso
  );
}

export function getDiscoveryCampaignDetail(campaignId: string): DiscoveryCampaignDetail | undefined {
  const campaign = getDiscoveryCampaignRecord(campaignId);
  if (!campaign) return undefined;

  return {
    campaign,
    sourceRuns: listSourceRunsForCampaign(campaignId),
    candidates: listCandidateRecordsForCampaign(campaignId),
    drafts: listOutreachDraftsForCampaign(campaignId),
  };
}
