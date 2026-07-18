import { initiativeSeed } from "@/lib/initiatives/seed";
import { db } from "@/lib/readiness/db";

db.exec(`
  CREATE TABLE IF NOT EXISTS initiatives (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    stage_key TEXT NOT NULL,
    stage_label TEXT NOT NULL,
    status_key TEXT NOT NULL,
    status_label TEXT NOT NULL,
    one_liner TEXT NOT NULL,
    primary_audiences_json TEXT NOT NULL DEFAULT '[]',
    primary_cta TEXT NOT NULL,
    current_marketing_focus TEXT NOT NULL,
    allowed_claims_json TEXT NOT NULL DEFAULT '[]',
    banned_claims_json TEXT NOT NULL DEFAULT '[]',
    needs_proof_claims_json TEXT NOT NULL DEFAULT '[]',
    claim_posture TEXT NOT NULL,
    narrative TEXT NOT NULL,
    tone_notes TEXT NOT NULL,
    public_url TEXT,
    repo_url TEXT,
    needs_positioning_review INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

const existingCount = (db.prepare(`SELECT COUNT(*) as count FROM initiatives`).get() as {
  count: number;
}).count;

if (existingCount === 0) {
  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO initiatives (
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
      @created_at,
      @updated_at
    )
  `);

  const tx = db.transaction(() => {
    for (const initiative of initiativeSeed) {
      insert.run({
        slug: initiative.slug,
        name: initiative.name,
        category: initiative.category,
        stage_key: initiative.stage.key,
        stage_label: initiative.stage.label,
        status_key: initiative.status.key,
        status_label: initiative.status.label,
        one_liner: initiative.oneLiner,
        primary_audiences_json: JSON.stringify(initiative.primaryAudiences),
        primary_cta: initiative.primaryCta,
        current_marketing_focus: initiative.currentMarketingFocus,
        allowed_claims_json: JSON.stringify(initiative.allowedClaims),
        banned_claims_json: JSON.stringify(initiative.bannedClaims),
        needs_proof_claims_json: JSON.stringify(initiative.needsProofClaims),
        claim_posture: initiative.claimPosture,
        narrative: initiative.narrative,
        tone_notes: initiative.toneNotes,
        public_url: initiative.publicUrl ?? null,
        repo_url: initiative.repoUrl ?? null,
        needs_positioning_review: initiative.needsPositioningReview ? 1 : 0,
        is_active: initiative.isActive ? 1 : 0,
        created_at: now,
        updated_at: now,
      });
    }
  });

  tx();
}

export { db };

