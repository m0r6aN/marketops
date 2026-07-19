import "@/lib/campaigns/db";

import { randomUUID } from "node:crypto";

import { db } from "@/lib/campaigns/db";
import type {
  CampaignAudienceCandidate,
  CampaignExecutionMode,
  CampaignExecutionStatus,
  CampaignLifecycleEvent,
  CampaignLifecycleInput,
  CampaignLifecycleRecord,
  CampaignReviewStatus,
} from "@/lib/campaigns/lifecycle-types";
import {
  listCandidateRecordsForCampaign,
  listDiscoveryCampaigns,
} from "@/lib/customer-finder/repository";

type LifecycleRow = {
  campaign_id: string;
  brief: string;
  offer: string;
  audience_segment: string;
  selected_candidate_ids_json: string;
  brand_voice_guideline_id: string;
  brand_voice_summary: string;
  asset_plan_json: string;
  channel_plan: string;
  outreach_plan: string;
  review_status: CampaignReviewStatus;
  execution_mode: CampaignExecutionMode;
  execution_status: CampaignExecutionStatus;
  execution_evidence: string;
  measurement_plan: string;
  primary_metric: string;
  target_value: string;
  actual_outcome: string;
  optimization_notes: string;
  next_iteration: string;
  created_at: string;
  updated_at: string;
};

type EventRow = {
  id: string;
  campaign_id: string;
  event_type: string;
  summary: string;
  detail_json: string;
  recorded_at: string;
};

function parseStringArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function mapLifecycleRow(row: LifecycleRow): CampaignLifecycleRecord {
  return {
    campaignId: row.campaign_id,
    brief: row.brief,
    offer: row.offer,
    audienceSegment: row.audience_segment,
    selectedCandidateIds: parseStringArray(row.selected_candidate_ids_json),
    brandVoiceGuidelineId: row.brand_voice_guideline_id ?? "",
    brandVoiceSummary: row.brand_voice_summary,
    assetPlan: parseStringArray(row.asset_plan_json),
    channelPlan: row.channel_plan,
    outreachPlan: row.outreach_plan,
    reviewStatus: row.review_status,
    executionMode: row.execution_mode,
    executionStatus: row.execution_status,
    executionEvidence: row.execution_evidence,
    measurementPlan: row.measurement_plan,
    primaryMetric: row.primary_metric,
    targetValue: row.target_value,
    actualOutcome: row.actual_outcome,
    optimizationNotes: row.optimization_notes,
    nextIteration: row.next_iteration,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEventRow(row: EventRow): CampaignLifecycleEvent {
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
    campaignId: row.campaign_id,
    eventType: row.event_type,
    summary: row.summary,
    detail,
    recordedAt: row.recorded_at,
  };
}

export function getCampaignLifecycle(campaignId: string): CampaignLifecycleRecord | undefined {
  const row = db
    .prepare(`SELECT * FROM campaign_lifecycles WHERE campaign_id = ?`)
    .get(campaignId) as LifecycleRow | undefined;
  return row ? mapLifecycleRow(row) : undefined;
}

function changedFields(
  existing: CampaignLifecycleRecord | undefined,
  input: CampaignLifecycleInput
): string[] {
  if (!existing) return Object.keys(input);

  return (Object.keys(input) as Array<keyof CampaignLifecycleInput>).filter((key) => {
    const before = existing[key];
    const after = input[key];
    return Array.isArray(before) && Array.isArray(after)
      ? JSON.stringify(before) !== JSON.stringify(after)
      : before !== after;
  });
}

export function saveCampaignLifecycle(
  campaignId: string,
  input: CampaignLifecycleInput
): CampaignLifecycleRecord {
  const existing = getCampaignLifecycle(campaignId);
  const nowIso = new Date().toISOString();
  const fields = changedFields(existing, input);

  db.transaction(() => {
    db.prepare(
      `
        INSERT INTO campaign_lifecycles (
          campaign_id, brief, offer, audience_segment, selected_candidate_ids_json,
          brand_voice_guideline_id, brand_voice_summary, asset_plan_json, channel_plan, outreach_plan, review_status,
          execution_mode, execution_status, execution_evidence, measurement_plan,
          primary_metric, target_value, actual_outcome, optimization_notes, next_iteration,
          created_at, updated_at
        ) VALUES (
          @campaign_id, @brief, @offer, @audience_segment, @selected_candidate_ids_json,
          @brand_voice_guideline_id, @brand_voice_summary, @asset_plan_json, @channel_plan, @outreach_plan, @review_status,
          @execution_mode, @execution_status, @execution_evidence, @measurement_plan,
          @primary_metric, @target_value, @actual_outcome, @optimization_notes, @next_iteration,
          @created_at, @updated_at
        )
        ON CONFLICT(campaign_id) DO UPDATE SET
          brief = excluded.brief,
          offer = excluded.offer,
          audience_segment = excluded.audience_segment,
          selected_candidate_ids_json = excluded.selected_candidate_ids_json,
          brand_voice_guideline_id = excluded.brand_voice_guideline_id,
          brand_voice_summary = excluded.brand_voice_summary,
          asset_plan_json = excluded.asset_plan_json,
          channel_plan = excluded.channel_plan,
          outreach_plan = excluded.outreach_plan,
          review_status = excluded.review_status,
          execution_mode = excluded.execution_mode,
          execution_status = excluded.execution_status,
          execution_evidence = excluded.execution_evidence,
          measurement_plan = excluded.measurement_plan,
          primary_metric = excluded.primary_metric,
          target_value = excluded.target_value,
          actual_outcome = excluded.actual_outcome,
          optimization_notes = excluded.optimization_notes,
          next_iteration = excluded.next_iteration,
          updated_at = excluded.updated_at
      `
    ).run({
      campaign_id: campaignId,
      brief: input.brief,
      offer: input.offer,
      audience_segment: input.audienceSegment,
      selected_candidate_ids_json: JSON.stringify(input.selectedCandidateIds),
      brand_voice_guideline_id: input.brandVoiceGuidelineId,
      brand_voice_summary: input.brandVoiceSummary,
      asset_plan_json: JSON.stringify(input.assetPlan),
      channel_plan: input.channelPlan,
      outreach_plan: input.outreachPlan,
      review_status: input.reviewStatus,
      execution_mode: input.executionMode,
      execution_status: input.executionStatus,
      execution_evidence: input.executionEvidence,
      measurement_plan: input.measurementPlan,
      primary_metric: input.primaryMetric,
      target_value: input.targetValue,
      actual_outcome: input.actualOutcome,
      optimization_notes: input.optimizationNotes,
      next_iteration: input.nextIteration,
      created_at: existing?.createdAt ?? nowIso,
      updated_at: nowIso,
    });

    if (fields.length > 0) {
      db.prepare(
        `
          INSERT INTO campaign_lifecycle_events
            (id, campaign_id, event_type, summary, detail_json, recorded_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `
      ).run(
        randomUUID(),
        campaignId,
        existing ? "campaign-lifecycle.updated" : "campaign-lifecycle.created",
        existing ? "Operator updated the campaign lifecycle plan." : "Operator created the campaign lifecycle plan.",
        JSON.stringify({ changedFields: fields }),
        nowIso
      );
    }

    if (existing && existing.executionStatus !== input.executionStatus) {
      db.prepare(
        `
          INSERT INTO campaign_lifecycle_events
            (id, campaign_id, event_type, summary, detail_json, recorded_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `
      ).run(
        randomUUID(),
        campaignId,
        "campaign-execution.status-recorded",
        input.executionMode === "manual"
          ? `Operator recorded manual execution status as ${input.executionStatus}.`
          : "MarketOps recorded provider-ready execution as not-started; no provider action occurred.",
        JSON.stringify({
          previousStatus: existing.executionStatus,
          status: input.executionStatus,
          mode: input.executionMode,
        }),
        nowIso
      );
    }
  })();

  return getCampaignLifecycle(campaignId)!;
}

export function listCampaignLifecycleEvents(campaignId: string): CampaignLifecycleEvent[] {
  const rows = db
    .prepare(
      `SELECT * FROM campaign_lifecycle_events WHERE campaign_id = ? ORDER BY recorded_at DESC, id DESC`
    )
    .all(campaignId) as EventRow[];
  return rows.map(mapEventRow);
}

export function listCampaignAudienceCandidates(initiativeSlug: string): CampaignAudienceCandidate[] {
  return listDiscoveryCampaigns()
    .filter((campaign) => campaign.initiativeSlug === initiativeSlug)
    .flatMap((campaign) =>
      listCandidateRecordsForCampaign(campaign.id).map((candidate) => ({
        id: candidate.id,
        discoveryCampaignId: campaign.id,
        discoveryCampaignName: campaign.campaignName,
        displayName: candidate.displayName,
        organizationName: candidate.organizationName,
        verifiedEvidence: candidate.verifiedEvidence,
        confidenceLabel: candidate.confidenceLabel,
        sourceSummary: candidate.sourceSummary,
      }))
    );
}

export function purgeCampaignLifecycleData(campaignId?: string) {
  if (campaignId) {
    db.prepare(`DELETE FROM campaign_lifecycle_events WHERE campaign_id = ?`).run(campaignId);
    db.prepare(`DELETE FROM campaign_lifecycles WHERE campaign_id = ?`).run(campaignId);
    return;
  }
  db.prepare(`DELETE FROM campaign_lifecycle_events`).run();
  db.prepare(`DELETE FROM campaign_lifecycles`).run();
}
