# Azure PostgreSQL Runbook — MarketOps Private Beta

Parcel `w1-postgres-rls-migrate`. Decision (already made, do not relitigate):
**Azure Database for PostgreSQL Flexible Server for beta; local dev stays
SQLite by default** (`MARKETOPS_DB=sqlite`). No live Azure work is required in
this parcel; beta live verification is deferred to INT `int-tenant-isolation`.

Contents: provisioning → managed-identity connection → migrations →
SQLite→PG backfill → PITR drill → least-privilege roles → RLS verification
queries → tenant-mapping audit → live-verification checklist.

Never commit secrets, keys, or connection strings. All values below marked
`<...>` are placeholders.

## 1. Provisioning (Flexible Server, beta)

Target: PostgreSQL 16, General Purpose, private access, Entra auth on.

```sh
az group create --name <rg-marketops-beta> --location <eastus2>

az postgres flexible-server create \
  --resource-group <rg-marketops-beta> \
  --name <marketops-beta-pg> \
  --location <eastus2> \
  --version 16 \
  --tier GeneralPurpose \
  --sku-name Standard_D2s_v3 \
  --storage-size 128 \
  --storage-auto-grow Enabled \
  --backup-retention 14 \
  --geo-redundant-backup Enabled \
  --high-availability Enabled \
  --zone <1> \
  --vnet <vnet-marketops-beta> \
  --subnet <snet-private-pg> \
  --private-dns-zone <privatelink.postgres.database.azure.com>

az postgres flexible-server parameter set \
  --resource-group <rg-marketops-beta> \
  --server-name <marketops-beta-pg> \
  --name rls.force_row_security --value on

az postgres flexible-server ad-admin create \
  --resource-group <rg-marketops-beta> \
  --server-name <marketops-beta-pg> \
  --display-name <marketops-beta-admin> \
  --object-id <entra-admin-object-id>
```

Record the server FQDN (`<marketops-beta-pg>.postgres.database.azure.com`).
SKU/storage are beta starting points, not load-tested commitments.

## 2. Managed-identity connection (no passwords in repo)

The app connects as a least-privilege role via Microsoft Entra auth. The
database password is an Entra access token minted at runtime — it never lands
in env files or the repo. Token plumbing is owned by parcel
`w1-secrets-vault-failclosed`; until then use the manual drill form below.

```sh
# App identity (user-assigned, attached to the beta App Service / Container App)
az identity create --resource-group <rg-marketops-beta> --name <id-marketops-beta>

# Register the identity as a PG user (as the Entra admin, via psql)
psql "host=<marketops-beta-pg>.postgres.database.azure.com dbname=postgres user=<admin-upn> sslmode=require" \
  -c "SELECT pgaadauth_create_principal('<id-marketops-beta>', false, false);"

# App connection string shape (token supplied as password at runtime)
# DATABASE_URL=postgres://<id-marketops-beta-client-id>@<marketops-beta-pg>.postgres.database.azure.com:5432/marketops?sslmode=require
```

Runtime contract used by `src/lib/db/provider.ts`:

| Variable | Required when | Notes |
|---|---|---|
| `MARKETOPS_DB=pg` | beta | selects the PG path; default stays `sqlite` |
| `DATABASE_URL` | beta | full connection string, `sslmode=require`; never commit |
| `MARKETOPS_TENANT_ID` | beta (until auth parcel) | explicit per-request tenant; no silent default on PG writes |
| `PGSSLMODE=disable` | local PG drills only | never set in beta |

Every PG query runs `BEGIN → SELECT set_config('app.tenant_id', $1, true) →
statement → COMMIT` (`queryWithTenant` / `withPgTenant`). `SET LOCAL` keeps
the tenant scoped to the current transaction on a pooled connection.

## 3. Applying migrations

Migrations live in `db/migrations/` (`001`, `002`, `003`), applied in order
by `src/lib/db/migrate.ts`, which records sha256 per file in
`schema_migrations` and **refuses on divergence** (edited-after-apply file,
deleted file, or gap below the highest applied version). There are no DOWN
migrations by design — rollback is a PITR restore (section 5).

```sh
# Preferred: psql in filename order (simple-query protocol handles
# multi-statement files), then verify bookkeeping matches disk:
for f in db/migrations/*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done

# Verify checksums recorded in schema_migrations match the files on disk
# (any mismatch = stop, investigate, never --force):
psql "$DATABASE_URL" -c "SELECT version, file_name, checksum FROM schema_migrations ORDER BY version;"
```

Operator alternative: drive the same files through `applyMigrations()` with a
`pg` client (identical ordering + divergence refusal, unit-tested in
`tests/db/migration.test.ts`).

## 4. SQLite → PG backfill (explicit default, never merged)

Local SQLite rows predate tenant scoping. The migration backfills them to the
explicit documented tenant `local-default` (`DEFAULT_TENANT_ID` in the
provider; each `002` table has an idempotent
`ADD COLUMN → UPDATE ... WHERE tenant_id IS NULL → SET NOT NULL` guard).

Drill for beta data import:

1. Export each SQLite table to CSV/JSON from `.marketops/marketops.sqlite`.
2. Assign exactly one explicit tenant per import batch. Local-only rows keep
   `local-default`; real beta rows get their `tenantId` from the tenant
   roster (`tests/contracts/fixtures/tenants.json` shape, mirrored in the
   `tenants` table). Never blend two tenants into one import.
3. `COPY`/insert with an explicit `tenant_id` on every row.
4. Verify counts per tenant match the export, then run the beta checks:
   `SELECT tenant_id, count(*) FROM <table> GROUP BY 1;` — every row must
   carry the intended tenant, and `local-default` must return **zero** rows
   in beta (section 6, check R6).

## 5. PITR backup / restore drill

1. Confirm backup config: retention ≥ 14 days, geo-redundant on, earliest
   restore time visible:
   `az postgres flexible-server show --resource-group <rg> --name <srv>`
2. Write a canary row as a known tenant, note UTC timestamp T0.
3. Restore to a NEW server (never over the primary):
   ```sh
   az postgres flexible-server restore \
     --resource-group <rg-marketops-beta> \
     --name <marketops-beta-pg-drill> \
     --source-server <marketops-beta-pg> \
     --restore-time <T0-plus-5m-UTC> \
     --vnet <vnet-marketops-beta> --subnet <snet-private-pg>
   ```
4. Against the drill server: canary row present, RLS policies present
   (`SELECT count(*) FROM pg_policies WHERE schemaname='public';` matches the
   primary), RLS verification queries (section 6) green.
5. Delete the drill server after sign-off. Record drill date + operator.

## 6. RLS verification queries (beta, run against every release)

```sql
-- R1: RLS enabled AND forced on all tenant tables (expect 40 rows + tenants).
SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  AND rowsecurity AND forcerowsecurity ORDER BY 1;

-- R2: one tenant-isolation policy per data table + tenants self-read.
SELECT tablename, policyname FROM pg_policies
  WHERE schemaname = 'public' ORDER BY 1;

-- R3: positive — tenant reads its own rows.
SET app.tenant_id = 'tenant-keon';
SELECT count(*) FROM content_versions;            -- > 0 after seed
SELECT count(*) FROM tenants;                     -- exactly 1 (own row)

-- R4: negative — cross-tenant reads leak zero rows.
SET app.tenant_id = 'tenant-biostack';
-- (re-run the tenant-keon row lookups by id; expect 0 rows)

-- R5: negative — writes to another tenant are rejected (WITH CHECK).
SET app.tenant_id = 'tenant-biostack';
-- INSERT INTO content_items (id, tenant_id, initiative_slug, ...)
--   VALUES ('probe', 'tenant-keon', ...);        -- must ERROR

-- R6: no local-default rows in beta (expect 0 for every table).
SELECT count(*) FROM <each-table> WHERE tenant_id = 'local-default';

-- R7: unset tenant denies by default (expect 0 rows, no error).
RESET app.tenant_id;
SELECT count(*) FROM initiatives;                 -- 0

RESET app.tenant_id;
```

`RESET` between checks: `app.tenant_id` is session state outside transactions;
the app itself only ever uses transaction-scoped `SET LOCAL`.

## 7. Least-privilege roles (apply after migrations)

```sql
-- App role:读写 tenant data, no DDL, no bookkeeping, no tenant writes.
-- (Run as owner / Entra admin.)
GRANT CONNECT ON DATABASE marketops TO marketops_app;
GRANT USAGE ON SCHEMA public TO marketops_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO marketops_app;
REVOKE ALL ON TABLE schema_migrations FROM marketops_app;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE tenants FROM marketops_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO marketops_app;
```

`tenants` keeps only the `tenants_self_read` SELECT policy for the app role;
tenant onboarding stays an owner-side operation.

## Appendix A — tenant-mapping audit (parcel step 1 record)

Audit date: this parcel. Finding: **0 of 13 modules scoped rows by tenant
before this parcel** — no `tenant_id` column, no tenant predicate, no RLS
anywhere. Every table below gains a direct `tenant_id` column (+ index) in
`002` and a `FOR ALL` isolation policy in `003`.

| Module (`src/lib/*/db.ts`) | Tables | Pre-parcel tenant scoping |
|---|---|---|
| readiness | readiness_state | none — keyed by (initiative_slug, definition_id) |
| initiatives | initiatives | none — global catalog keyed by slug |
| brand-voice | brand_voice_guidelines, brand_voice_events | none — keyed by initiative_slug / guideline_id |
| content-workspace | content_items, content_versions, content_generation_runs, content_events | none — keyed by initiative_slug / item+version ids |
| customer-finder | customer_finder_campaigns, _source_runs, _candidates, _candidate_provenance, _outreach_drafts, _suppressions, _events | none — keyed by campaign/candidate ids |
| discoverability-audits | discoverability_audits | none — keyed by initiative_slug |
| citation-readiness | citation_plan_items, _versions, _events | none — keyed by initiative_slug / plan ids |
| email-campaigns | email_campaign_items, _versions, _events | none — keyed by initiative_slug / item ids |
| campaigns | campaigns, campaign_lifecycles, campaign_lifecycle_events | none — keyed by initiative_slug / campaign_id |
| library | library_import_batches, _source_documents, _entries, _conflicts, _trash_records, _marketing_review_summaries, _marketing_red_flags, _marketing_asset_opportunities | none — several tables lack even initiative_slug (linked only via batch/entry ids), hence direct tenant_id |
| persuasion-review | persuasion_reviews, persuasion_apply_runs, persuasion_review_events | none — keyed by initiative_slug / review ids |
| video-scripts | video_script_items, _versions, _events | none — keyed by initiative_slug / script ids |
| youtube-transcripts | youtube_transcript_records | none — keyed by initiative_slug |

Not tenant-scoped by design: `schema_migrations` (owner-only bookkeeping),
`tenants` registry (self-read policy only, writes owner-only).

Open decisions (recorded, explicitly NOT decided here): (1) whether
today-global UNIQUEs (slugs, fingerprints, item+version) must become
per-tenant `UNIQUE(tenant_id, ...)` before beta; (2) whether `initiatives`
stays a shared catalog or is seeded per tenant; (3) whether
`customer_finder_suppressions` stays per-tenant or becomes a global denylist.
All three need the auth/entitlement parcels before beta.

## Appendix B — beta live-verification checklist (deferred to INT int-tenant-isolation)

- [ ] R1–R7 green against the beta server after a fresh migration run.
- [ ] `tenants` holds exactly the rostered beta tenants; R6 zero everywhere.
- [ ] Cross-tenant negative probes (R4/R5) executed for at least two tenants
      with receipts attached to the security gate `sec-tenant-isolation`.
- [ ] PITR drill (section 5) completed against a dated restore with evidence.
- [ ] App role GRANTs (section 7) applied; owner-only tables probed denied.
- [ ] Managed-identity token path (section 2) exercised end-to-end, no
      password anywhere in config or logs.
