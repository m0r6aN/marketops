# Azure Key Vault Runbook (MarketOps private beta)

Decision (do not relitigate in this parcel): beta uses **Azure Key Vault +
managed identity**; local dev uses **env vars** (`.env.local`). Never commit
secrets. Fail-closed: boot refuses when `MARKETOPS_FC_HMAC_KEY` is missing —
no DevKey fallback.

Related code:

- TS: `src/lib/library/ai-client-secrets.ts` (`EnvSecretProvider`,
  `KeyVaultSecretProvider`, `assertBootSecrets`, `requireFcHmacKey`).
- C#: `src/MarketOps/Security/` (`ISecretProvider`, `EnvSecretProvider`,
  `KeyVaultSecretProvider`, `FcSigner` throws when the key is missing).
- Gate evidence: `tests/secret-provider-failclosed.test.ts`
  (env provider units, boot-without-key refusal, DevKey-gone, Key Vault fake).

## 1. Vault layout

One vault per environment (example names; use your own resource group):

- `kv-marketops-beta` (beta), `kv-marketops-prod` (later; separate vault).

Secret names use **dashes** (Key Vault disallows underscores). Logical env var
(left) maps to vault secret name (right):

| Env var (local / app setting key)      | Vault secret name            | Notes                                   |
| -------------------------------------- | ---------------------------- | --------------------------------------- |
| `MARKETOPS_FC_HMAC_KEY` (**required**) | `marketops-fc-hmac-key`      | FC advisory HMAC key. No fallback.      |
| `ANTHROPIC_API_KEY`                    | `anthropic-api-key`          | Library LLM path.                       |
| `BLACKBOX_API_KEY`                     | `blackbox-api-key`           | Library Blackbox path.                  |
| `MARKETOPS_ED25519_PRIVATE_KEY_PATH`   | n/a (file path, not secret)  | Ed25519 key file; beta must set explicit path (see §5 open item). |
| `MARKETOPS_KEY_VAULT_URL`              | n/a (config, not secret)     | e.g. `https://kv-marketops-beta.vault.azure.net/` |

Generate keys with a CSPRNG (example: 32+ random bytes, base64). Never reuse
across environments. Never paste values into chat, tickets, or docs.

## 2. Managed-identity wiring (Container Apps, beta)

1. Enable a managed identity on the Container App (system-assigned is fine for beta):
   - Portal: Container App → Identity → System assigned → On.
   - Or Bicep/Terraform: `identity: { type: 'SystemAssigned' }`.
2. Grant **least privilege** on the vault (RBAC, preferred over access policies):
   - Role: **Key Vault Secrets User** (`4633458b-17de-408a-b874-0445c86b69e6`)
     scoped to the vault (or to individual secrets when the vault holds more).
   - Principal: the Container App's managed identity.
   - No `Secrets Officer` / no key-management roles for the app identity.
3. App configuration (no secret values in env):
   - `MARKETOPS_KEY_VAULT_URL=https://kv-marketops-beta.vault.azure.net/`
   - Do NOT set `MARKETOPS_FC_HMAC_KEY` as a plain env var in beta; the app
     resolves it from Key Vault at boot via `DefaultAzureCredential`
     (managed identity). Locally the same code path uses `EnvSecretProvider`.
4. Code path (beta-wired, locally unconstructed):
   - TS: `createKeyVaultProvider(process.env.MARKETOPS_KEY_VAULT_URL!)`
     (never called locally; local uses `defaultEnvProvider`).
   - C#: `new KeyVaultSecretProvider(vaultUrl)` (IMDS managed-identity
     credential; only `Azure.Security.KeyVault.Secrets` is referenced).
5. Verify (beta):
   - Deploy, then check boot logs: app starts only when the vault secret exists
     and RBAC has propagated (can take minutes). Revoke access → next
     boot/restart must refuse with `MARKETOPS_FC_HMAC_KEY is not set...`.
   - Confirm no secret values in logs (errors name the variable only).

## 3. Rotation steps (`marketops-fc-hmac-key`)

Signatures are HMAC-SHA256 over canonical JSON; rotating the key invalidates
old signatures (expected — receipts carry `keyId`, verify accordingly).

1. Generate the new key offline (CSPRNG, 32+ bytes).
2. In Key Vault, create a **new version** of `marketops-fc-hmac-key`
   (do not delete the old version yet): `az keyvault secret set --vault-name
   kv-marketops-beta --name marketops-fc-hmac-key --value '<new>'`.
   Prefer `az` with `--output none` and shell history disabled, or the portal.
3. Restart the Container App revision (picks up the latest version).
4. Smoke-test: issue a dry-run advisory, verify `fc.signature.hmac` passes
   with the new key.
5. Keep the old version `Enabled=false` (not deleted) until all in-flight
   verifications complete; then schedule deletion per retention policy.
6. Local dev: each developer updates their own `.env.local` out-of-band
   (password manager). Never share via repo, chat logs, or screenshots.

Incident rotation (suspected leak): rotate immediately per above, audit Key
Vault access logs, and treat previously signed artifacts as untrusted until
re-issued.

## 4. Local `.env` convention

- Files: `.env.local` (real values, gitignored — never commit). There is no
  `.env.example` in this repo; if one is added later it must list
  `MARKETOPS_FC_HMAC_KEY` as **required with no value**.
- Required locally: `MARKETOPS_FC_HMAC_KEY` (any per-dev random value;
  dummy test keys use the `test-only-...` prefix and never touch real vaults).
- Optional locally: `ANTHROPIC_API_KEY`, `BLACKBOX_API_KEY` (only for the
  Library paths you exercise).
- Non-secret local knobs keep safe defaults: `OLLAMA_HOST`,
  `BLACKBOX_API_BASE_URL`, `MARKETOPS_PORT`.
- Boot check: `assertBootSecrets()` (TS) / `new FcSigner()` (C#) throws when
  `MARKETOPS_FC_HMAC_KEY` is missing. Manual check:
  `MARKETOPS_FC_HMAC_KEY` unset → refuse; set to a dummy → start.
- Hygiene: `git status` must never show `.env*` (gitignore covers
  `.env`, `.env.*` except `.env.example`/`.sample`/`.template`); `git diff`
  must never contain key material; logs must never print values.

## 5. Open items / non-goals of this parcel

- `Ed25519Signer` ephemeral-keypair fallback was intentionally left as-is:
  making it fail-closed would require a `Program.cs` DI change (forbidden in
  this parcel). Coordinator decision needed for beta (explicit key path vs.
  vault-stored key material).
- No C# unit tests were added (existing `tests/MarketOps.Tests` were only
  updated to pass explicit test-only keys so `dotnet test` stays green).
  TS coverage is the sec-secrets evidence for this parcel.
- Contracts carry no secret fields (verified: no `secret|password|api[_-]?key|
  hmac|private[_-]?key` matches under `contracts/`).
