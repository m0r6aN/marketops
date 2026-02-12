# Run Verification Checklist

**Run ID:** `00b61575-e041-42a5-aba9-dce48e7d9d80`
**Scenario:** unknown
**Mode:** dry_run
**Generated:** 2026-02-12T04:21:11.2059992+00:00

## Invariant Checks

- [ ] Mode is `dry_run`
- [ ] All 0 intents have `blockedByMode=true`
- [ ] Zero side-effect receipts with `success=true`

## Artifact Integrity

- [ ] `publication-plan.json` — SHA-256: `3cae172fb01b946dbc4f4a7975611ccfda666f99eef71d304792a925b244f9dc` (311 bytes)
- [ ] `proof-ledger.json` — SHA-256: `b22767bc0f3852223eda8903a1139d42fd5604ce1760d847c491462c108b99b0` (410 bytes)
- [ ] `judge-advisory-receipt.json` — SHA-256: `35940d8ec844660b1fbcefe4b63a7edda6549936e1f876df113c0e1843222824` (1282 bytes)
- [ ] `approver-summary.json` — SHA-256: `4c134136fdc9a4c858b43a3784b672de515e4f214bf61fe78f3c7289e09df8a3` (1140 bytes)
- [ ] `approver-summary.md` — SHA-256: `7a175ed651866e0ab6789a4f791886cb008ae432294063c77e45a213ff40c7d1` (904 bytes)
- [ ] `fc-binding.json` — SHA-256: `a56551e1ff279541a3738c70df20b1db941e09641d9496ae15694179c6297649` (2141 bytes)

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
