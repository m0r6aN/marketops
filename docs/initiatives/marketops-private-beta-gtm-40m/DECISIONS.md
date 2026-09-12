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
| d-consent-mapping | Campaign consentBasis → ComplianceCheck consentBasis mapping unruled; callers supply explicitly | open | product |
| d-suppression-tenant | Suppression store lacks tenant column vs contract non-leak requirement | open | coordinator |
| d-ed25519-fallback | Ed25519Signer ephemeral-keypair fallback left as-is; needs Program.cs DI change | open | coordinator |
| d-unique-scope | Global vs per-tenant UNIQUEs (slugs, fingerprints) | open | product |
| d-initiative-tenancy | Shared catalog vs per-tenant initiative seeds | open | product |
