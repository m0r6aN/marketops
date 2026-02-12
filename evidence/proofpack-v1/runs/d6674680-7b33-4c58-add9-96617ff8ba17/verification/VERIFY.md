# Run Verification Checklist

**Run ID:** `d6674680-7b33-4c58-add9-96617ff8ba17`
**Scenario:** 01-hygiene-sweep
**Mode:** dry_run
**Generated:** 2026-02-12T03:29:40.1389196+00:00

## Invariant Checks

- [ ] Mode is `dry_run`
- [ ] All 3 intents have `blockedByMode=true`
- [ ] Zero side-effect receipts with `success=true`

## Artifact Integrity

- [ ] `publication-plan.json` — SHA-256: `b985d26fcc0df43c1c86cc1627750a15a4546f5603419d8f69348b343bbf22ab` (1366 bytes)
- [ ] `proof-ledger.json` — SHA-256: `3b35ff575e57460d992bfc972a3df34acc6ee8c4c9508ee86c4c447c1603aad0` (3040 bytes)
- [ ] `judge-advisory-receipt.json` — SHA-256: `f51de9e9a06c1094c18adad10717e3fa68b5848ca34992dda67ae5e089a87d3f` (1250 bytes)
- [ ] `approver-summary.json` — SHA-256: `5eef8257b1c2a8b18f930ddc8918cedfb8a8a92f456750373a987ad7c0901bc4` (2899 bytes)
- [ ] `approver-summary.md` — SHA-256: `aeda2a0e17c3ccd11aa531b4e5ee87850245d19a040195b697a1fdd1bccac263` (1526 bytes)
- [ ] `fc-binding.json` — SHA-256: `a400b0617377fca11cad3f682156387d6f9482be473e3f3f6a5b10d10de21564` (1934 bytes)

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

- [ ] Manifest signed with Ed25519 (keyId: `keon.marketops.proofpack.ed25519.v1:dcf966cf13b8af81`)
- [ ] Public key shipped at `keys/proofpack_signing_public.ed25519`
- [ ] Signature verifies against canonical JSON (excluding signature block)

## Pack Seal

- [ ] RUN_MANIFEST.json SHA-256 matches PACK_INDEX entry
- [ ] Pack seal (packSha256) recomputes correctly
