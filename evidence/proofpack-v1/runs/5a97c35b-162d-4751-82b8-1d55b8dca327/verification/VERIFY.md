# Run Verification Checklist

**Run ID:** `5a97c35b-162d-4751-82b8-1d55b8dca327`
**Scenario:** 04-policy-violation-direct-push-main
**Mode:** dry_run
**Generated:** 2026-02-12T02:19:45.9141155+00:00

## Invariant Checks

- [ ] Mode is `dry_run`
- [ ] All 4 intents have `blockedByMode=true`
- [ ] Zero side-effect receipts with `success=true`
- [ ] 1 intent(s) have `blockedByPolicy=true`
- [ ] Each policy-denied intent has a `ruleId` in approver-summary

## Artifact Integrity

- [ ] `publication-plan.json` — SHA-256: `1c4f1613ab4bb8c7386f6486b376b16af964bc661c34160ee35e7756984ba373` (1507 bytes)
- [ ] `proof-ledger.json` — SHA-256: `625a6b1ee30313063f28ba19946e14e3ccd0f8b3762b20d5d1cf88444dc02907` (3975 bytes)
- [ ] `judge-advisory-receipt.json` — SHA-256: `fbff8722188e1bca54f7a506cc921dedcd0afbf2c17e0d83498286e7df51e0af` (424 bytes)
- [ ] `approver-summary.json` — SHA-256: `ed91f773a7e77051dc69fa6f4b040ded1e2ff1143bbb0cd52dc9f6f1c44f853b` (4488 bytes)
- [ ] `approver-summary.md` — SHA-256: `65fecce5ff79563b8ecae50ca2372134d3d270d781a113da387845e054b2e8dd` (2505 bytes)

## Policy Verdict

- [ ] Verdict: `denied`
- [ ] Recommendation: `deny`

## Pack Seal

- [ ] RUN_MANIFEST.json SHA-256 matches PACK_INDEX entry
- [ ] Pack seal (packSha256) recomputes correctly
