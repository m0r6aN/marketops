import { db } from "@/lib/initiatives/db";
import type {
    Initiative,
    InitiativeInput,
    InitiativeStageKey,
    PortfolioMetrics,
} from "@/lib/initiatives/types";

type RawInitiativeRow = {
  slug: string;
  name: string;
  category: string;
  stage_key: Initiative["stage"]["key"];
  stage_label: string;
  status_key: Initiative["status"]["key"];
  status_label: string;
  one_liner: string;
  primary_audiences_json: string;
  primary_cta: string;
  current_marketing_focus: string;
  allowed_claims_json: string;
  banned_claims_json: string;
  needs_proof_claims_json: string;
  claim_posture: string;
  narrative: string;
  tone_notes: string;
  public_url: string | null;
  repo_url: string | null;
  needs_positioning_review: number;
  is_active: number;
  created_at: string;
  updated_at: string;
};

const emptyLaunchStageDistribution: Record<InitiativeStageKey, number> = {
  "public-proof": 0,
  alpha: 0,
  concept: 0,
};

function mapRow(row: RawInitiativeRow): Initiative {
  return {
    slug: row.slug,
    name: row.name,
    category: row.category,
    stage: { key: row.stage_key, label: row.stage_label },
    status: { key: row.status_key, label: row.status_label },
    oneLiner: row.one_liner,
    primaryAudiences: JSON.parse(row.primary_audiences_json),
    primaryCta: row.primary_cta,
    currentMarketingFocus: row.current_marketing_focus,
    allowedClaims: JSON.parse(row.allowed_claims_json),
    bannedClaims: JSON.parse(row.banned_claims_json),
    needsProofClaims: JSON.parse(row.needs_proof_claims_json),
    claimPosture: row.claim_posture,
    narrative: row.narrative,
    toneNotes: row.tone_notes,
    publicUrl: row.public_url ?? undefined,
    repoUrl: row.repo_url ?? undefined,
    needsPositioningReview: Boolean(row.needs_positioning_review),
    isActive: Boolean(row.is_active),
  };
}

function toDbParams(input: InitiativeInput, now: string) {
  return {
    slug: input.slug,
    name: input.name,
    category: input.category,
    stage_key: input.stage.key,
    stage_label: input.stage.label,
    status_key: input.status.key,
    status_label: input.status.label,
    one_liner: input.oneLiner,
    primary_audiences_json: JSON.stringify(input.primaryAudiences),
    primary_cta: input.primaryCta,
    current_marketing_focus: input.currentMarketingFocus,
    allowed_claims_json: JSON.stringify(input.allowedClaims),
    banned_claims_json: JSON.stringify(input.bannedClaims),
    needs_proof_claims_json: JSON.stringify(input.needsProofClaims),
    claim_posture: input.claimPosture,
    narrative: input.narrative,
    tone_notes: input.toneNotes,
    public_url: input.publicUrl ?? null,
    repo_url: input.repoUrl ?? null,
    needs_positioning_review: input.needsPositioningReview ? 1 : 0,
    is_active: input.isActive ? 1 : 0,
    updated_at: now,
  };
}

export function listInitiatives(options?: { includeInactive?: boolean }): Initiative[] {
  const includeInactive = options?.includeInactive ?? false;
  const rows = db
    .prepare(
      `SELECT * FROM initiatives
       ${includeInactive ? "" : "WHERE is_active = 1"}
       ORDER BY name COLLATE NOCASE ASC`
    )
    .all() as RawInitiativeRow[];
  return rows.map(mapRow);
}

export function getInitiativeBySlug(slug: string): Initiative | null {
  const row = db
    .prepare(`SELECT * FROM initiatives WHERE slug = ? AND is_active = 1`)
    .get(slug) as RawInitiativeRow | undefined;
  return row ? mapRow(row) : null;
}

export function getInitiativeBySlugAnyStatus(slug: string): Initiative | null {
  const row = db
    .prepare(`SELECT * FROM initiatives WHERE slug = ?`)
    .get(slug) as RawInitiativeRow | undefined;
  return row ? mapRow(row) : null;
}

export function createInitiative(input: InitiativeInput): Initiative {
  const now = new Date().toISOString();
  const params = toDbParams(input, now);

  db.prepare(
    `INSERT INTO initiatives (
      slug, name, category,
      stage_key, stage_label,
      status_key, status_label,
      one_liner,
      primary_audiences_json,
      primary_cta,
      current_marketing_focus,
      allowed_claims_json,
      banned_claims_json,
      needs_proof_claims_json,
      claim_posture,
      narrative,
      tone_notes,
      public_url,
      repo_url,
      needs_positioning_review,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      @slug, @name, @category,
      @stage_key, @stage_label,
      @status_key, @status_label,
      @one_liner,
      @primary_audiences_json,
      @primary_cta,
      @current_marketing_focus,
      @allowed_claims_json,
      @banned_claims_json,
      @needs_proof_claims_json,
      @claim_posture,
      @narrative,
      @tone_notes,
      @public_url,
      @repo_url,
      @needs_positioning_review,
      @is_active,
      @updated_at,
      @updated_at
    )`
  ).run(params);

  return getInitiativeBySlugAnyStatus(input.slug)!;
}

export function updateInitiative(existingSlug: string, input: InitiativeInput): Initiative {
  const now = new Date().toISOString();
  const params = {
    ...toDbParams(input, now),
    existing_slug: existingSlug,
  };

  db.prepare(
    `UPDATE initiatives SET
      slug = @slug,
      name = @name,
      category = @category,
      stage_key = @stage_key,
      stage_label = @stage_label,
      status_key = @status_key,
      status_label = @status_label,
      one_liner = @one_liner,
      primary_audiences_json = @primary_audiences_json,
      primary_cta = @primary_cta,
      current_marketing_focus = @current_marketing_focus,
      allowed_claims_json = @allowed_claims_json,
      banned_claims_json = @banned_claims_json,
      needs_proof_claims_json = @needs_proof_claims_json,
      claim_posture = @claim_posture,
      narrative = @narrative,
      tone_notes = @tone_notes,
      public_url = @public_url,
      repo_url = @repo_url,
      needs_positioning_review = @needs_positioning_review,
      is_active = @is_active,
      updated_at = @updated_at
    WHERE slug = @existing_slug`
  ).run(params);

  return getInitiativeBySlugAnyStatus(input.slug)!;
}

export function archiveInitiative(slug: string): void {
  const now = new Date().toISOString();
  db.prepare(`UPDATE initiatives SET is_active = 0, updated_at = ? WHERE slug = ?`).run(now, slug);
}

export function getPortfolioMetrics(): PortfolioMetrics {
  const active = listInitiatives();

  return {
    totalInitiatives: active.length,
    activeInitiatives: active.filter((initiative) => initiative.isActive).length,
    needsPositioningReviewCount: active.filter((initiative) => initiative.needsPositioningReview)
      .length,
    launchStageDistribution: active.reduce<Record<InitiativeStageKey, number>>((acc, initiative) => {
      acc[initiative.stage.key] += 1;
      return acc;
    }, { ...emptyLaunchStageDistribution }),
  };
}
