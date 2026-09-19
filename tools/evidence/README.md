# Evidence seal harness

Turn tested code into sealed evidence: a sealed bundle is an immutable
directory under `evidence/bundles/<name>-<version>/` holding copies of
test transcripts and working logs plus a `manifest.json` that pins the
exact commands, the environment, a per-artifact SHA-256 inventory, and an
explicit negative-case (deny / block / quarantine) inventory.

## Run → seal → publish

1. **Run** the suites locally and capture full transcripts (stdout + stderr,
   unedited). Toolchain first:
   `npm install --no-save --no-package-lock --no-audit --no-fund`.
2. **Seal** with the harness (refuses to overwrite an existing version —
   corrections ship as a new version and link back with `--supersedes`):
   ```sh
   node tools/evidence/seal.mjs seal-bundle <name> <version> \
     --artifact <src>=<dest> [--artifact <src>=<dest> ...] \
     --command "<exact re-run command>" [--command ...] \
     --negative "<deny/block/quarantine case>" [--negative ...] \
     [--note "<honest limitation or skip reason>"] \
     [--supersedes <earlier-bundle-version>] \
     [--chain-head <hash>] [--chain-head-note "<text>"]
   ```
   `<src>` is repo-relative (or absolute); `<dest>` is bundle-relative.
   If any step fails environmentally, record it with `--note` (skip with
   reason in the manifest — outputs are never edited into a pass).
3. **Publish** the custody path: commit the new bundle directory and cite
   the bundle version (e.g. `evidence/bundles/int-local-v1`) wherever the
   results are referenced. Sealed bundles are the sealed layer; the
   `evidence/INT-*.md` working logs stay as working logs (bundles copy,
   never move).

## Verify (offline, anyone can re-run)

```sh
node tools/evidence/verify-bundle.mjs evidence/bundles/<name>-<version>
node tools/evidence/verify-bundle.mjs --all
```

The verifier recomputes every artifact hash from live bytes, checks the
required manifest fields, and fails closed with an explicit reason class:
`[missing field]`, `[gap]` (empty commands / artifacts / negatives),
`[tamper]` (bytes no longer recompute, or a file vanished), `[mismatch]`
(renamed bundle, malformed hash, wrong optional-field shape). Exit 0 only
when every named bundle passes. CI runs `--all` on every PR.

## Canonical-vocabulary rule

Status claims in `docs/` and `evidence/` use the canonical vocabulary
only: **Evidence Ledger**, **receipt chain**, **Decision Receipt**,
**Evidence Pack**, **offline verifier** — plus a concrete bundle reference
(`evidence/bundles/<name>-<version>`) wherever results are cited. Working
names for internals stay out of status text. The CI vocabulary gate
(`.github/workflows/evidence-seal.yml`) rejects sealed-claim wording in
changed files under `docs/` + `evidence/` unless the same file cites a
bundle reference. The gate scopes to PR-changed files on purpose: the
pre-existing working logs legitimately describe in-progress work, so a
whole-tree scan would flag history instead of gating new claims.

## Harness independence

The harness is node builtins only (no new dependencies). Anyone with node
plus the pinned commands can re-run the sealed commands and re-verify
every hash — no private tooling, no network, no trust in the store.

## Chain-vs-bundle boundary

This harness seals files, not ledger rows. When the Evidence Ledger
receipt-chain head is cheaply available at seal time, record it with
`--chain-head`; otherwise the manifest carries `chainHead: null` plus an
explicit `chainHeadNote` (S11-live composition: the chain is composed live
at runtime, so an offline file bundle pins no static head) instead of a
fabricated reference.

## Manifest reference

Required: `bundle`, `version`, `sealedAtUtc`, `commands[]` (non-empty),
`envPins {node, packageLockHash, gitCommit}`, `artifacts[]` (non-empty;
each `{path, sha256}` with `sha256:<64 hex>` over raw file bytes),
`negativeCases[]` (non-empty — negatives are mandatory). Optional:
`chainHead`, `chainHeadNote`, `supersedes`, `notes[]` (skip reasons,
dirty-tree records, environment limits).
