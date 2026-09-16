# Sealed campaign notes — bundle int-local-v1 (`evidence/bundles/int-local-v1`)

First sealed campaign of the evidence seal harness: the three local INT
suites plus the read-only Evidence Pack verifier run, with full transcripts
captured as sealed artifacts.

## What ran (exact commands are pinned in `manifest.json` commands[])

- `npx vitest run tests/integration/isolation.test.ts` — 10/10 pass (INT-a:
  tenant + auth isolation across initiatives, library, persuasion-review).
- `npx vitest run tests/integration/claim-billing.test.ts` — 11/11 pass
  (INT-b: entitlement x claim gates, composed).
- `npx vitest run tests/integration/email-receipt-mcp.test.ts` — 12/12 pass
  (INT-c: no-send enforcement, receipt verifiability, MCP canon quarantine).
- `evidence/proofpack-v1/VERIFY.ps1` (read-only use) — 56/58 checks pass;
  both failures are the same environmental cause (the EdVerify .NET binary
  is not published locally, so the per-run Ed25519 signature check cannot
  execute). Recorded honestly; not worked around.
- `npm run lint` — clean. `npm run typecheck` — clean on this base.

## Honest limits (skips with reasons, never edits into a pass)

- No live Postgres: RLS live checks are not part of this campaign (beta
  scope, see the working logs).
- No live Stripe / network / charge paths; webhook coverage is test-mode
  only by design.
- No live model execution for the MCP quarantine path (mock echoes source
  excerpts verbatim by design).
- EdVerify binary absent: VERIFY.ps1 stays at 56/58 until `tools/EdVerify`
  is published (outside this parcel's allowed files).
- `chainHead` is null: the Evidence Ledger receipt chain is composed live
  at runtime (S11-live composition), so this offline file bundle pins no
  static chain head. See `tools/evidence/README.md` (chain-vs-bundle
  boundary) and the manifest `chainHeadNote`.

## Custody (re-run + re-verify)

Re-run the pinned commands from the repo root, then re-verify offline:

```sh
node tools/evidence/verify-bundle.mjs evidence/bundles/int-local-v1
```

Sealed copies under `working-logs/` are verbatim from the source working
logs above their seal-trailer marker; the marker cites this bundle
(`evidence/bundles/int-local-v1`) as the custody reference.
