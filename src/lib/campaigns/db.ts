import { managedCampaignSeed } from "@/lib/campaigns/seed";
import { db } from "@/lib/readiness/db";

db.exec(`
  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    initiative_slug TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    goal TEXT NOT NULL,
    channel TEXT NOT NULL,
    audience TEXT NOT NULL,
    primary_cta TEXT NOT NULL,
    current_focus TEXT NOT NULL,
    asset_types_json TEXT NOT NULL DEFAULT '[]',
    claim_sensitivity TEXT NOT NULL,
    launch_readiness TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS campaign_lifecycles (
    campaign_id TEXT PRIMARY KEY,
    brief TEXT NOT NULL DEFAULT '',
    offer TEXT NOT NULL DEFAULT '',
    audience_segment TEXT NOT NULL DEFAULT '',
    selected_candidate_ids_json TEXT NOT NULL DEFAULT '[]',
    brand_voice_guideline_id TEXT NOT NULL DEFAULT '',
    brand_voice_summary TEXT NOT NULL DEFAULT '',
    asset_plan_json TEXT NOT NULL DEFAULT '[]',
    channel_plan TEXT NOT NULL DEFAULT '',
    outreach_plan TEXT NOT NULL DEFAULT '',
    review_status TEXT NOT NULL DEFAULT 'draft',
    execution_mode TEXT NOT NULL DEFAULT 'manual',
    execution_status TEXT NOT NULL DEFAULT 'not-started',
    execution_evidence TEXT NOT NULL DEFAULT '',
    measurement_plan TEXT NOT NULL DEFAULT '',
    primary_metric TEXT NOT NULL DEFAULT '',
    target_value TEXT NOT NULL DEFAULT '',
    actual_outcome TEXT NOT NULL DEFAULT '',
    optimization_notes TEXT NOT NULL DEFAULT '',
    next_iteration TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS campaign_lifecycle_events (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    summary TEXT NOT NULL,
    detail_json TEXT NOT NULL DEFAULT '{}',
    recorded_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_campaign_lifecycle_events_campaign
    ON campaign_lifecycle_events(campaign_id, recorded_at DESC);
`);

const lifecycleColumns = db.prepare(`PRAGMA table_info(campaign_lifecycles)`).all() as Array<{ name: string }>;
if (!lifecycleColumns.some((column) => column.name === "brand_voice_guideline_id")) {
  db.exec(`ALTER TABLE campaign_lifecycles ADD COLUMN brand_voice_guideline_id TEXT NOT NULL DEFAULT ''`);
}

const insert = db.prepare(`
  INSERT INTO campaigns (
    id,
    initiative_slug,
    name,
    status,
    goal,
    channel,
    audience,
    primary_cta,
    current_focus,
    asset_types_json,
    claim_sensitivity,
    launch_readiness,
    notes,
    created_at,
    updated_at,
    deleted_at
  ) VALUES (
    @id,
    @initiative_slug,
    @name,
    @status,
    @goal,
    @channel,
    @audience,
    @primary_cta,
    @current_focus,
    @asset_types_json,
    @claim_sensitivity,
    @launch_readiness,
    @notes,
    @created_at,
    @updated_at,
    NULL
  )
  ON CONFLICT(id) DO NOTHING
`);

const tx = db.transaction(() => {
  for (const seed of managedCampaignSeed) {
    const now = new Date().toISOString();
    insert.run({
      id: seed.id,
      initiative_slug: seed.initiativeSlug,
      name: seed.name,
      status: seed.status,
      goal: seed.goal,
      channel: seed.channel,
      audience: seed.audience,
      primary_cta: seed.primaryCta,
      current_focus: seed.currentFocus,
      asset_types_json: JSON.stringify(seed.assetTypes),
      claim_sensitivity: seed.claimSensitivity,
      launch_readiness: seed.launchReadiness,
      notes: seed.notes,
      created_at: now,
      updated_at: now,
    });
  }
});

tx();

export { db };

