import { db } from "@/lib/content-workspace/db";
db.exec(`
CREATE TABLE IF NOT EXISTS email_campaign_items(id TEXT PRIMARY KEY,initiative_slug TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS email_campaign_versions(id TEXT PRIMARY KEY,email_campaign_item_id TEXT NOT NULL,initiative_slug TEXT NOT NULL,version_number INTEGER NOT NULL,title TEXT NOT NULL,status TEXT NOT NULL,campaign_id TEXT NOT NULL,campaign_name TEXT NOT NULL,objective TEXT NOT NULL,audience_segment TEXT NOT NULL,sender_name TEXT NOT NULL,reply_to TEXT NOT NULL,consent_basis TEXT NOT NULL,suppression_plan TEXT NOT NULL,unsubscribe_plan TEXT NOT NULL,sender_authentication_plan TEXT NOT NULL,physical_address_plan TEXT NOT NULL,primary_metric TEXT NOT NULL,secondary_metrics_json TEXT NOT NULL,attribution_window_days INTEGER NOT NULL,steps_json TEXT NOT NULL,notes TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,approved_at TEXT,UNIQUE(email_campaign_item_id,version_number));
CREATE TABLE IF NOT EXISTS email_campaign_events(id TEXT PRIMARY KEY,email_campaign_item_id TEXT NOT NULL,email_campaign_version_id TEXT NOT NULL,initiative_slug TEXT NOT NULL,event_type TEXT NOT NULL,summary TEXT NOT NULL,detail_json TEXT NOT NULL,recorded_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_initiative ON email_campaign_versions(initiative_slug,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_campaign_events_version ON email_campaign_events(email_campaign_version_id,recorded_at DESC);
`);export{db};
