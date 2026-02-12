# Run Verification Checklist

**Run ID:** `5a94c079-3caa-44cb-b257-bcb77b853727`
**Scenario:** unknown
**Mode:** dry_run
**Generated:** 2026-02-12T04:21:11.2258564+00:00

## Invariant Checks

- [ ] Mode is `dry_run`
- [ ] All 0 intents have `blockedByMode=true`
- [ ] Zero side-effect receipts with `success=true`

## Artifact Integrity

- [ ] `publication-plan.json` — SHA-256: `c31d3c1a5771a653c17f416b9a7a159162f1d209ff69da108d904a73efeb0f34` (311 bytes)
- [ ] `proof-ledger.json` — SHA-256: `e781fef30d00cf27d97d243c129a7a1bdf4c76f0b80add147b24536ff57b6f27` (411 bytes)
- [ ] `judge-advisory-receipt.json` — SHA-256: `48112e9131099c6acb5902a176b64de282b3dab0e254b777050ec8d16646e5da` (1282 bytes)
- [ ] `approver-summary.json` — SHA-256: `ae4d6c8938997e6eb0a55665c032ca5684d44e0c8a44f6b3197f104d76ad7275` (1140 bytes)
- [ ] `approver-summary.md` — SHA-256: `5375a9848842c847afbcdbe9c149c3fcea87fcad9c4d455c499722514995e510` (904 bytes)
- [ ] `fc-binding.json` — SHA-256: `c5ee09080ed3cfdac9aaaf1298ac35fc8386661302506b01610977cfac865969` (2141 bytes)

## Policy Verdict

- [ ] Verdict: `clear`
- [ ] Recommendation: `review_ready`

## FC Binding

- [ ] Advisory receipt is present with issuer (Federation Core)
- [ ] `receipt.runId` matches manifest `runId`
- [ ] `receipt.planSha256` matches SHA-256 of `publication-plan.json`
- [ ] HMAC-SHA256 signature is valid
- [ ] Ledger references `receiptId` and `receiptDigest`
- [ ] See `verification/fc-binding.json` and `verification/FC_BINDING.md`

## Ed25519 Manifest Signature

- [ ] Manifest signed with Ed25519 (keyId: `keon.marketops.proofpack.ed25519.v1:1e7291d07b0f5085`)
- [ ] Public key shipped at `keys/proofpack_signing_public.ed25519`
- [ ] Signature verifies against canonical JSON (excluding signature block)

## Pack Seal

- [ ] RUN_MANIFEST.json SHA-256 matches PACK_INDEX entry
- [ ] Pack seal (packSha256) recomputes correctly
