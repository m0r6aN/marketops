# Decisions — marketops-private-beta-gtm-40m

| ID | Title | Status | Owner |
|---|---|---|---|
| d-fly-azure | Azure: Container Apps + PG Flexible + Key Vault, managed identity; isolation + fail-closed + repeatable CI before onboarding | decided | coordinator |
| d-auth-strategy | Email magic-link; local beta code issuer, real delivery deferred | decided | coordinator |
| d-stripe-realm | Test-mode only; no keys in repo; manual invoicing | decided | coordinator |
| d-claim-threshold | Strict publication gate: block confirmed violations; uncertainty → needs-review; neither permits publication; log evidence/policy/rationale; calibrate with labeled evals | decided | product |
| d-public-scope | Public site stays private-beta only; full SaaS deferred | decided | coordinator |
| ca-001 | Amendment: C#/fixture files in w0 scope (new files only) | approved | coordinator |
| d-lockfile | Lock synced via #17; W1 branches rebased as needed | decided | coordinator |
| d-beta-hero-path | Hero at src/app/beta/page.tsx → /beta (#22); (beta)/ group unshippable | decided | coordinator |
| d-pg-deps | pg/@types/pg (#25), @azure/* + KeyVault.Secrets (#24) approved; no other W1 package changes | decided | coordinator |
| d-consent-mapping | explicit-consent→opt-in; existing-relationship + legitimate-interest-reviewed→legitimate-interest; other-reviewed→none; encode in h-consent-mapping | decided | product |
| d-suppression-tenant | Per-tenant: tenant_id + backfill + RLS in #27 migration 005 | decided | coordinator |
| d-ed25519-fallback | Fail-close in beta via Program.cs DI change; H parcel h-ed25519-failclosed | decided | coordinator |
| d-unique-scope | Per-tenant composite UNIQUEs in #27 migration 004 | decided | product |
| d-initiative-tenancy | Shared read-only catalog + tenant-scoped writes; enforcement in h-catalog-readonly | decided | product |
| h-entitlement-store | DB-backed entitlement store (replace static roster) queued | open | coordinator |
| h-webhook-signature | Live webhook signature verification queued | open | coordinator |
| d-receipt-canon | Claim receipts live in additive persuasion tables mapped to Receipt/ApprovalState; needs canon confirmation | open | coordinator |
| d-approval-entitlement | Whether claim approval sits behind approval-workflow entitlement | open | product |
| db-migrate-claim-tables | PG migration for claim_decision_receipts + claim_approvals queued (blocks beta PG) | open | coordinator |
