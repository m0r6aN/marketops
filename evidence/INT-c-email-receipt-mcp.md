# INT-c-email-receipt-mcp — Integration Evidence (local)

Parcel: `int-c-email-receipt-mcp` | Surfaces S5+S6+S7 | Environment: local
Branch: `feat/int-c-email-receipt-mcp` | Base: `f2782ba`
Date (UTC): 2026-09-13
Test: `tests/integration/email-receipt-mcp.test.ts` (12 tests, all green)

Goal: prove no-send enforcement, receipt verifiability, and MCP canon
quarantine in the local env. No product decisions were made; nothing under
`src/**`, `contracts/**`, `mcp/**`, or `evidence/proofpack-v1/**` was edited.

## Scenario table

| Scenario | Path | What was proven | Test | Result |
|---|---|---|---|---|
| int-email-blocked | positive | Fully-compliant plan evaluates `pass` AND still results in not-sent (`outcome=blocked`, `sent=false`) | email positive | PASS |
| int-email-blocked | negative | `none` consent → blocked + `missing consent basis`; missing unsub → blocked + `missing unsubscribe link`; failed sender-auth → blocked + sender-auth reason | email negative ×3 | PASS |
| int-email-blocked | failure | Send attempt against any blocked check (all 5 fail shapes incl. suppression/physical-address) is refused; outcome stays `blocked`/`sent=false` | send-refusal sweep | PASS |
| int-email-blocked | invariant | No `send`/`adapter`/`deliver` export exists on the email service or compliance modules | no-send scan | PASS |
| int-receipt-verify | positive | Dry-run `ProofpackManifest` in the `contracts/ProofpackManifest.json` shape validates (Ajv) | receipt positive | PASS |
| int-receipt-verify | boundary | Tampered `packSha256` and empty `runs` are rejected by the contract | receipt boundary | PASS |
| int-receipt-verify | failure | Prod-mode action (`proofpack export (prod)`) without auth refuses fail-closed: pure guard `UNAUTHENTICATED`/401 + `requireSessionTenant` throws `TenantScopeError` 401/`UNAUTHENTICATED`/`decision` | receipt negative | PASS |
| int-receipt-verify | artifact | `evidence/proofpack-v1/VERIFY.ps1` run locally (read-only): 56/58, both failures are the missing EdVerify binary | transcript below | 56/58 HONEST |
| int-mcp-canon | positive | Valid `docs_as_marketing_review`-shaped payload persists candidates via the Library writer path (`persistMarketingReview`): 1 entry + 1 red flag + 1 asset; entries land as `marketing_nugget`/`candidate` with quarantine-by-default flags | mcp positive | PASS |
| int-mcp-canon | boundary | Unknown tags rejected; red flag without `safer_wording`/`proof_requirement` rejected (`MarketingReviewValidationError`) | writer boundary | PASS |
| int-mcp-canon | negative | Secret-bearing / pricing-leak doc quarantined BEFORE the writer: sensitive filenames flagged, prompt contracts forbid pricing/credentials, tainted candidates dropped, persisted output contains no secret/pricing tokens | mcp negative | PASS |

Read-only references used (never edited): `src/lib/email-campaigns/compliance.ts`
+ service wrapper re-export, `tests/email-compliance-gates.test.ts`,
`evidence/proofpack-v1/VERIFY.ps1`, `mcp/marketops-mcp/src/tools/docsAsMarketingReview.ts`
(handler `runDocsAsMarketingReview`), `src/rubrics` + skill
(`src/skills/docs-as-marketing-review.md`, persist mode → `@/lib/library/marketing-review-writer`),
quarantine logic (`src/lib/library/parser.ts` `detectSensitiveFilename`,
`src/lib/library/prompts.ts` exclusion contracts, writer quarantine-by-default
flags `visibility=private`, `publicSafe=false`, `approvedForAutomation=false`,
`publicAutomationAllowed=false`).

## VERIFY.ps1 transcript summary (exact excerpt)

Command: `powershell -NoProfile -ExecutionPolicy Bypass -File evidence/proofpack-v1/VERIFY.ps1`
Result: **2 of 58 CHECKS FAILED** (56 passed). Both failures are the same
environment cause — the EdVerify .NET binary is not published locally:

```text
========================================
  MarketOps Proof Pack Verifier v1.3
========================================

EdVerify:    NOT FOUND (Ed25519 checks will FAIL)

Pack ID:     pack-20260212-042111
Created:     2026-02-12T04:21:11.2287956+00:00
Runs:        2
Pack Seal:   b28e253fb8485e3d6c2bf6d95cd9ee60dae3cee0560530768a9e3b154a26a5cc

--- Run: 00b61575-e041-42a5-aba9-dce48e7d9d80 (unknown) ---
  --- Ed25519 Signature ---
  PASS: Public key found at keys/proofpack_signing_public.ed25519
  PASS: keyId fingerprint verified (1e7291d07b0f5085)
  FAIL: EdVerify tool not found - cannot verify Ed25519
  PASS: RUN_MANIFEST.json hash matches
  PASS: publication-plan.json (311B)
  PASS: proof-ledger.json (410B)
  PASS: judge-advisory-receipt.json (1282B)
  PASS: approver-summary.json (1140B)
  PASS: approver-summary.md (904B)
  PASS: fc-binding.json (2141B)
  --- FC Binding ---
  PASS: FC binding verdict = fc_bound
  ... (all FC-binding, tenant-consistency, seal, and pack-tenant checks PASS)

--- Run: 5a94c079-3caa-44cb-b257-bcb77b853727 (unknown) ---
  --- Ed25519 Signature ---
  PASS: Public key found at keys/proofpack_signing_public.ed25519
  PASS: keyId fingerprint verified (1e7291d07b0f5085)
  FAIL: EdVerify tool not found - cannot verify Ed25519
  ... (all remaining checks PASS)

--- Pack Seal Verification ---
  PASS: Pack seal verified
--- Pack Tenant Verification ---
  PASS: PACK_INDEX.tenantId = 'tenant-demo'
  PASS: Run 00b61575-e041-42a5-aba9-dce48e7d9d80 tenantId matches pack
  PASS: Run 5a94c079-3caa-44cb-b257-bcb77b853727 tenantId matches pack

========================================
  RESULT: 2 of 58 CHECKS FAILED
========================================
```

(`...` marks elided repetition of passing lines also present in the full
output above; every PASS/FAIL line shown is verbatim. No artifacts absent:
all hashed artifacts, FC bindings, and tenant checks resolved locally.)

## Honest limitations

1. VERIFY.ps1 is 56/58, not 58/58: `tools/EdVerify` is not published locally
   (`EdVerify: NOT FOUND`), so the per-run Ed25519 signature check cannot
   execute. Publishing it (`dotnet publish` under `tools/`) is outside this
   parcel's allowed files; recorded honestly instead of worked around.
2. No live send adapter exists by design — refusal is proven at the gate
   boundary (evaluation outcome + test-local refusal guard + export scan),
   not against a live provider.
3. Live-LLM extraction inside `docs_as_marketing_review` was NOT executed
   (beta-deferred, see below); the mock echoes excerpts verbatim by design,
   so executing it could not honestly prove quarantine.
4. `mcp/marketops-mcp` was left untouched (read-only use per parcel): no
   `npm run build` / `npm test` ran there, no `dist/` created.
5. The test's dry-run manifest uses synthetic 64-hex hashes for
   contract-shape validation only; seal truth comes from VERIFY.ps1, not the test.

## Beta-deferred list

- Live-model secret/pricing redaction inside `docs_as_marketing_review`
  (mock vs ollama providers) — reason: needs a live model service; mock
  echoes source excerpts verbatim by design (`tool.test.ts` "no fabrication"
  test), so a mock run would leak by construction and prove nothing.
- Full 58/58 VERIFY.ps1 — reason: needs the EdVerify binary published from
  `tools/EdVerify` (out of parcel scope).
- Live provider send-attempt against a real ESP — not applicable by design
  (send stays blocked; no adapter exists).
