# Run Verification Checklist

**Run ID:** `2c1894c6-90b0-4ab2-8256-63fb2817dc9e`
**Scenario:** 01-hygiene-sweep
**Mode:** dry_run
**Generated:** 2026-02-12T02:19:45.8998608+00:00

## Invariant Checks

- [ ] Mode is `dry_run`
- [ ] All 3 intents have `blockedByMode=true`
- [ ] Zero side-effect receipts with `success=true`

## Artifact Integrity

- [ ] `publication-plan.json` — SHA-256: `3998d96d5a60c1ccfe9a8fb7f07544adc58570075201a210d161c69db04031d5` (1364 bytes)
- [ ] `proof-ledger.json` — SHA-256: `7bb40d879a59f4d0af7849bfaf6dffdd8dff6e3a7026fc9abfc5ee62419c5dfb` (2917 bytes)
- [ ] `judge-advisory-receipt.json` — SHA-256: `680b9fc307d1fefd28eb16cba913fe8b354f7d07fce7966944ca09effb7697c1` (290 bytes)
- [ ] `approver-summary.json` — SHA-256: `8dcb251d2a01fdb0c40e856b857017a0d74082c424207b875bad71c4252a0621` (2897 bytes)
- [ ] `approver-summary.md` — SHA-256: `d73ebf21e0d0b9ca2046757ca39100934f5215be0f431b45c022e48288b04d47` (1526 bytes)

## Policy Verdict

- [ ] Verdict: `clear`
- [ ] Recommendation: `review_ready`

## Pack Seal

- [ ] RUN_MANIFEST.json SHA-256 matches PACK_INDEX entry
- [ ] Pack seal (packSha256) recomputes correctly
