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
`);

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

