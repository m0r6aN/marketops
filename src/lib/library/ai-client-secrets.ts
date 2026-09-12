/**
 * Library secret provider abstraction (fail-closed).
 *
 * Local: `EnvSecretProvider` reads `process.env` and throws when a required
 * secret is missing. Beta: `KeyVaultSecretProvider` reads Azure Key Vault
 * with managed identity (`DefaultAzureCredential`).
 *
 * Rules:
 * - NEVER commit secrets. NEVER log secret values (errors name the variable only).
 * - No DevKey / fallback / default-secret: missing key = throw (fail-closed).
 * - `KeyVaultSecretProvider` is beta-wired and locally unconstructed: production
 *   constructs it only in Container Apps with managed identity. Local dev and
 *   tests use `EnvSecretProvider` (or an injected fake client for Key Vault tests).
 */
import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";

// ─────────────────────────────────────────────────────────────────────────────
// Names
// ─────────────────────────────────────────────────────────────────────────────

/** Env var (and logical secret name) for the Federation Core HMAC key. Required at boot. */
export const FC_HMAC_KEY_NAME = "MARKETOPS_FC_HMAC_KEY";

/** Minimal Key Vault client surface we depend on (lets tests inject a fake, no network). */
export interface KeyVaultClientLike {
  getSecret(name: string): Promise<{ value?: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider interfaces
// ─────────────────────────────────────────────────────────────────────────────

/** Sync provider (env). `getRequiredSecret` throws when missing — fail-closed. */
export interface SecretProvider {
  getSecret(name: string): string | undefined;
  getRequiredSecret(name: string): string;
}

/** Async provider (Key Vault). `getRequiredSecretAsync` throws when missing — fail-closed. */
export interface AsyncSecretProvider {
  getSecretAsync(name: string): Promise<string | undefined>;
  getRequiredSecretAsync(name: string): Promise<string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Env provider (local)
// ─────────────────────────────────────────────────────────────────────────────

function missingSecretError(name: string): Error {
  // Never include the value — name the variable only.
  return new Error(
    `${name} is not set. Add it to .env.local (local) or configure Azure Key Vault (beta). Refusing to start with a fallback key.`,
  );
}

function normalizeSecretValue(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  // Treat empty / whitespace-only as missing (fail-closed; avoids "" bypass).
  if (value.trim().length === 0) return undefined;
  return value;
}

/** Reads secrets from `process.env`. No defaults, no fallback. */
export class EnvSecretProvider implements SecretProvider {
  getSecret(name: string): string | undefined {
    return normalizeSecretValue(process.env[name]);
  }

  getRequiredSecret(name: string): string {
    const value = this.getSecret(name);
    if (value === undefined) throw missingSecretError(name);
    return value;
  }
}

/** Shared default env provider instance. */
export const defaultEnvProvider = new EnvSecretProvider();

/** Returns the FC HMAC key or throws (fail-closed). Never logs the value. */
export function requireFcHmacKey(provider: SecretProvider = defaultEnvProvider): string {
  return provider.getRequiredSecret(FC_HMAC_KEY_NAME);
}

/**
 * Boot gate: throws when `MARKETOPS_FC_HMAC_KEY` is missing (fail-closed).
 * Call at process boot; do NOT catch-and-continue.
 */
export function assertBootSecrets(provider: SecretProvider = defaultEnvProvider): void {
  provider.getRequiredSecret(FC_HMAC_KEY_NAME);
}

// ─────────────────────────────────────────────────────────────────────────────
// Key Vault provider (beta, managed identity; locally unconstructed)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Azure Key Vault secret name mapping. Key Vault names use dashes (no underscores):
 * env `MARKETOPS_FC_HMAC_KEY` <-> vault secret `marketops-fc-hmac-key`, etc.
 */
export function toVaultSecretName(envName: string): string {
  return envName.toLowerCase().replace(/_/g, "-");
}

/**
 * Key Vault-backed provider for beta.
 *
 * Beta-wired, locally unconstructed: construct ONLY in Container Apps with a
 * managed identity (via `createKeyVaultProvider`). Local dev uses
 * `EnvSecretProvider`. Tests inject `client` (fake) — no network.
 */
export class KeyVaultSecretProvider implements AsyncSecretProvider {
  private readonly client: KeyVaultClientLike;

  constructor(vaultUrl: string, client?: KeyVaultClientLike, credential?: object) {
    if (client) {
      this.client = client;
      return;
    }
    if (!vaultUrl || vaultUrl.trim().length === 0) {
      throw new Error(
        "Key Vault vaultUrl is not set. Configure MARKETOPS_KEY_VAULT_URL (beta).",
      );
    }
    const cred = (credential ?? new DefaultAzureCredential()) as ConstructorParameters<
      typeof SecretClient
    >[1];
    this.client = new SecretClient(vaultUrl, cred);
  }

  async getSecretAsync(envName: string): Promise<string | undefined> {
    const vaultName = toVaultSecretName(envName);
    try {
      const secret = await this.client.getSecret(vaultName);
      return normalizeSecretValue(secret?.value);
    } catch (err) {
      // SecretNotFound (404) => missing, not fatal for optional reads.
      if (err instanceof Error && /SecretNotFound|404/i.test(err.message)) return undefined;
      throw err;
    }
  }

  async getRequiredSecretAsync(envName: string): Promise<string> {
    const value = await this.getSecretAsync(envName);
    if (value === undefined) throw missingSecretError(envName);
    return value;
  }
}

/**
 * Beta factory: builds a `KeyVaultSecretProvider` with `DefaultAzureCredential`
 * (managed identity). Call ONLY in beta/Container Apps — never locally.
 */
export function createKeyVaultProvider(vaultUrl: string): KeyVaultSecretProvider {
  return new KeyVaultSecretProvider(vaultUrl);
}
