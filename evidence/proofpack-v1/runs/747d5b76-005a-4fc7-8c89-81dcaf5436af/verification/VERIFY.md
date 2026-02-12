# Run Verification Checklist

**Run ID:** `747d5b76-005a-4fc7-8c89-81dcaf5436af`
**Scenario:** 04-policy-violation-direct-push-main
**Mode:** dry_run
**Generated:** 2026-02-12T03:29:40.1045404+00:00

## Invariant Checks

- [ ] Mode is `dry_run`
- [ ] All 4 intents have `blockedByMode=true`
- [ ] Zero side-effect receipts with `success=true`
- [ ] 1 intent(s) have `blockedByPolicy=true`
- [ ] Each policy-denied intent has a `ruleId` in approver-summary

## Artifact Integrity

- [ ] `publication-plan.json` — SHA-256: `6e2c55561209c05bb9f8da1b000d1cd5aa8b86e15de0c0a02d2aa8147f95481c` (1510 bytes)
- [ ] `proof-ledger.json` — SHA-256: `31c901a06115bc9538130e2faf4073c0074dc59a91bec329ec60f83022b9ff94` (4097 bytes)
- [ ] `judge-advisory-receipt.json` — SHA-256: `2a1de1c7d1282bcb3e81e63e92a09cf60bb042448833f2c17366873b78f65dbe` (1382 bytes)
- [ ] `approver-summary.json` — SHA-256: `adc4967fdfbcc2c5676f4d28da237cf1f6d7e43b9539db302beb02b23b359830` (4487 bytes)
- [ ] `approver-summary.md` — SHA-256: `8450eb337fa62482865cf6365684b20603647fd62787a6fb18089506c97d1286` (2505 bytes)
- [ ] `fc-binding.json` — SHA-256: `e4f88f5937aaf9009ce12d87b665931f7126e8f24ba1a2c8f51909445f5c59cc` (1954 bytes)

## Policy Verdict

- [ ] Verdict: `denied`
- [ ] Recommendation: `deny`

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
