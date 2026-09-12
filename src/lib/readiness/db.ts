// w1-postgres-rls-migrate: connection moved to @/lib/db/provider (sqlite
// default, same file). This module keeps the readiness_state DDL only.
import { db, dbPath } from "@/lib/db/provider";

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
