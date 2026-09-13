# INT-a-isolation evidence — int-tenant-isolation (local)

Parcel: int-a-isolation | Surfaces S1 (web-tenant-db) + S2 (auth-session) |
Environment: local | Scenario: int-tenant-isolation

Goal: prove tenant+auth isolation end to end at the service/action layer via
the composed session -> guard -> predicate chain
(`issueSessionToken` -> `requireSessionTenant({ token })` ->
`requireRowTenantMatch(sessionTenant, row, action)` +
`isRowVisibleToTenant` for reads) across three lanes
(initiatives, library, persuasion-review).

Composed-only scope: token issue/verify + pure-guard shapes are proven in
`tests/auth/session-scope.test.ts`; repository predicates + migration/SQL
semantics in `tests/tenant-wire/tenant-wire.test.ts`. This parcel proves the
composition neither covers alone. No `src/**` changes; test + evidence only.

## Scenario table

| Scenario | Surface | Env | Result | Evidence |
|---|---|---|---|---|
| Positive: keon session reads + writes keon initiative rows | S1+S2 | local | PASS | `tests/integration/isolation.test.ts` — positive describe, initiatives case (composed `guardedRead`/`guardedWrite` resolve `tenant-keon`, visibility true) |
| Positive: keon session reads + writes keon library rows | S1+S2 | local | PASS | same file — library case (row key spelling `tenant_id`) |
| Positive: keon session reads + writes keon persuasion-review rows | S1+S2 | local | PASS | same file — persuasion-review case (row key spelling `tenant`) |
| Negative: biostack session on keon initiative rows -> 403 TENANT_MISMATCH | S1+S2 | local | PASS | negative describe, initiatives case — read + write both throw `TenantScopeError` 403 with `denialCode`/`denialMessage` (both tenants)/`failureStage: decision` + `Forbidden` body |
| Negative: biostack session on keon library rows -> 403 TENANT_MISMATCH | S1+S2 | local | PASS | same, library case |
| Negative: biostack session on keon persuasion rows -> 403 TENANT_MISMATCH | S1+S2 | local | PASS | same, persuasion-review case |
| Negative: tampered keon token -> denied on every lane | S2 | local | PASS | tampered-token test — `verifySessionToken` null + composed write throws 401 UNAUTHENTICATED with shape on all 3 lanes |
| Failure: null session -> 401/denied | S2 | local | PASS | failure test — composed write throws 401 UNAUTHENTICATED per lane + `assertTenantAccess(null, keon)` denial object shape (401/decision/receipt) |
| Failure: unknown resource tenant -> denied fail-closed | S1+S2 | local | PASS | failure test — `assertTenantAccess(keon, null)` 403 TENANT_MISMATCH ("unknown") + `requireTenantMatch(keon, null/""/undefined)` throws 403 with shape |
| Failure: unknown session tenant -> denied | S2 | local | PASS | failure test — `issueSessionToken("tenant-intruder"/"")` throws (refused) + `assertTenantAccess(intruder, keon)` 401 UNAUTHENTICATED |

New tests: 10 (3 positive + 4 negative + 3 failure). Full suite: 21 files,
188 passed, 1 skipped (pre-existing skip in `tests/db/migration.test.ts`).

## Commit

Isolation commit: `d34dbb6` ("test(int-a-isolation): prove tenant+auth isolation end to end (local)", base `f2782ba`). Canonical pushed hash: see PR `## Commits` (this evidence file was finalized in a metadata amend, so HEAD may be one amend ahead of the hash recorded here).
Branch: `feat/int-a-isolation` (base `f2782ba`, clean worktree at start).

## Command transcript summary

All run in `C:\Repos\MarketOps.int-a-isolation` (toolchain first, per parcel):

1. `npm install --no-save --no-package-lock --no-audit --no-fund` — pass
   (759 packages; pre-existing deprecation warnings only:
   prebuild-install, eslint 9.39.5).
2. `npm run typecheck` (`tsc --noEmit`) — pass, clean.
3. `npm run lint` (`eslint`) — pass, clean.
4. `npx vitest run tests/integration/isolation.test.ts` — pass
   (1 file, 10/10 tests).
5. `npm test` (full `vitest run`) — green: 21 files passed,
   188 passed, 1 skipped (pre-existing).

`git fetch origin` before PR; `origin/main` == base `f2782ba`, no rebase
divergence. `git status --short` clean except the three allowed new files.

## Known limitations (no live PG)

- No live Postgres in this parcel: RLS live checks are NOT proven here.
  Deferred to INT-beta against the beta server using
  `docs/marketops/azure-postgres-runbook.md` section 6 queries R1 (RLS
  enabled+forced), R2 (isolation policies), R3 (own-tenant reads), R4
  (cross-tenant reads leak zero), R5 (cross-tenant writes rejected WITH
  CHECK), R6 (no `local-default` rows), R7 (unset tenant denies), plus the
  Appendix B beta live-verification checklist.
- Local sqlite rows predate `tenant_id` (single-tenant local store), so
  composition is proven with tenant-tagged in-memory rows at the
  session -> guard -> predicate layer, not via DB-level filtering.
- Legacy rows without any tenant key remain session-visible by design
  (documented in each repository header; beta PG rows always carry
  `tenant_id` + RLS). Not re-asserted here — covered by tenant-wire.
- Fixture note: `tests/contracts/fixtures/tenants.json` currently lists
  `tenant-biostack` as `active`; parcel context described it as lapsed.
  Isolation proof does not depend on `betaStatus` (roster membership only);
  flagged as an observation, no product decision taken.
