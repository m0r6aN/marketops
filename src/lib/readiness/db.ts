import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), ".marketops");
const dbPath = path.join(dataDir, "marketops.sqlite");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS readiness_state (
    initiative_slug TEXT NOT NULL,
    definition_id TEXT NOT NULL,
    complete INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (initiative_slug, definition_id)
  );
`);

export { db, dbPath };
