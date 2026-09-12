/**
 * sec-secrets gate: fail-closed secret handling.
 *
 * - Env provider unit tests (no defaults, empty = missing, errors name vars only).
 * - Boot-without-key refusal test (`assertBootSecrets` / `requireFcHmacKey` throw).
 * - DevKey-gone assertion (no fallback: missing key returns undefined / throws).
 * - Key Vault provider against an injected fake client (no network).
 *
 * All keys below are dummy test fixtures (`test-only-...`), never real secrets.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  EnvSecretProvider,
  FC_HMAC_KEY_NAME,
  KeyVaultSecretProvider,
  assertBootSecrets,
  defaultEnvProvider,
  requireFcHmacKey,
  toVaultSecretName,
  type KeyVaultClientLike,
} from "@/lib/library/ai-client-secrets";
import { getBlackboxApiConfig } from "@/lib/library/ai-client-blackbox";

const TEST_DUMMY_FC_KEY = "test-only-fc-hmac-key-not-a-secret-0123456789";
const TEST_DUMMY_BLACKBOX_KEY = "test-only-blackbox-key-not-a-secret";

let savedFcKey: string | undefined;
let savedBlackboxKey: string | undefined;

beforeEach(() => {
  savedFcKey = process.env[FC_HMAC_KEY_NAME];
  savedBlackboxKey = process.env["BLACKBOX_API_KEY"];
});

afterEach(() => {
  if (savedFcKey === undefined) delete process.env[FC_HMAC_KEY_NAME];
  else process.env[FC_HMAC_KEY_NAME] = savedFcKey;
  if (savedBlackboxKey === undefined) delete process.env["BLACKBOX_API_KEY"];
  else process.env["BLACKBOX_API_KEY"] = savedBlackboxKey;
});

function clearFcKey(): void {
  delete process.env[FC_HMAC_KEY_NAME];
}

describe("EnvSecretProvider (local)", () => {
  test("returns the value when set", () => {
    process.env[FC_HMAC_KEY_NAME] = TEST_DUMMY_FC_KEY;
    expect(new EnvSecretProvider().getSecret(FC_HMAC_KEY_NAME)).toBe(TEST_DUMMY_FC_KEY);
    expect(new EnvSecretProvider().getRequiredSecret(FC_HMAC_KEY_NAME)).toBe(TEST_DUMMY_FC_KEY);
  });

  test("returns undefined / throws when missing (no fallback)", () => {
    clearFcKey();
    const provider = new EnvSecretProvider();
    expect(provider.getSecret(FC_HMAC_KEY_NAME)).toBeUndefined();
    expect(() => provider.getRequiredSecret(FC_HMAC_KEY_NAME)).toThrow(FC_HMAC_KEY_NAME);
  });

  test("treats empty and whitespace-only as missing (fail-closed)", () => {
    for (const bad of ["", "   ", "\t\n "]) {
      process.env[FC_HMAC_KEY_NAME] = bad;
      const provider = new EnvSecretProvider();
      expect(provider.getSecret(FC_HMAC_KEY_NAME)).toBeUndefined();
      expect(() => provider.getRequiredSecret(FC_HMAC_KEY_NAME)).toThrow(FC_HMAC_KEY_NAME);
    }
  });

  test("missing-key error names the variable but never the value", () => {
    clearFcKey();
    try {
      new EnvSecretProvider().getRequiredSecret(FC_HMAC_KEY_NAME);
      expect.unreachable("expected throw");
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain(FC_HMAC_KEY_NAME);
      expect(message).not.toContain(TEST_DUMMY_FC_KEY);
      expect(message).toMatch(/refus/i);
    }
  });
});

describe("boot fail-closed (sec-secrets evidence)", () => {
  test("boot refuses without MARKETOPS_FC_HMAC_KEY", () => {
    clearFcKey();
    expect(() => assertBootSecrets()).toThrow(FC_HMAC_KEY_NAME);
    expect(() => assertBootSecrets(defaultEnvProvider)).toThrow(FC_HMAC_KEY_NAME);
    expect(() => requireFcHmacKey()).toThrow(FC_HMAC_KEY_NAME);
  });

  test("boot starts with a dummy key", () => {
    process.env[FC_HMAC_KEY_NAME] = TEST_DUMMY_FC_KEY;
    expect(() => assertBootSecrets()).not.toThrow();
    expect(requireFcHmacKey()).toBe(TEST_DUMMY_FC_KEY);
  });

  test("DevKey fallback is gone: no default key material when env is missing", () => {
    clearFcKey();
    // Behavioral proof there is no hardcoded fallback: optional read is
    // undefined (not a dev key), required read throws.
    expect(new EnvSecretProvider().getSecret(FC_HMAC_KEY_NAME)).toBeUndefined();
    expect(() => requireFcHmacKey(new EnvSecretProvider())).toThrow(
      /Refusing to start with a fallback key/,
    );
  });

  test("ai-client-blackbox goes through the provider (fail-closed, no fallback)", () => {
    delete process.env["BLACKBOX_API_KEY"];
    expect(() => getBlackboxApiConfig()).toThrow("BLACKBOX_API_KEY");
    process.env["BLACKBOX_API_KEY"] = TEST_DUMMY_BLACKBOX_KEY;
    expect(getBlackboxApiConfig().apiKey).toBe(TEST_DUMMY_BLACKBOX_KEY);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Key Vault provider (fake client, no network)
// ─────────────────────────────────────────────────────────────────────────────

class FakeVaultClient implements KeyVaultClientLike {
  constructor(private readonly secrets: Record<string, string>) {}

  async getSecret(name: string): Promise<{ value?: string }> {
    const value = this.secrets[name];
    if (value === undefined) {
      // Mirror the SDK's SecretNotFound shape (message match, no network).
      throw new Error(`SecretNotFound: ${name}`);
    }
    return { value };
  }
}

describe("KeyVaultSecretProvider (injected fake, no network)", () => {
  test("maps env names to vault names (underscores to dashes, lowercase)", () => {
    expect(toVaultSecretName("MARKETOPS_FC_HMAC_KEY")).toBe("marketops-fc-hmac-key");
    expect(toVaultSecretName("ANTHROPIC_API_KEY")).toBe("anthropic-api-key");
  });

  test("returns values from the fake vault", async () => {
    const provider = new KeyVaultSecretProvider(
      "https://fake-vault.vault.azure.net/",
      new FakeVaultClient({ "marketops-fc-hmac-key": TEST_DUMMY_FC_KEY }),
    );
    await expect(provider.getSecretAsync(FC_HMAC_KEY_NAME)).resolves.toBe(TEST_DUMMY_FC_KEY);
    await expect(provider.getRequiredSecretAsync(FC_HMAC_KEY_NAME)).resolves.toBe(
      TEST_DUMMY_FC_KEY,
    );
  });

  test("missing vault secret => undefined / throws (fail-closed, names var only)", async () => {
    const provider = new KeyVaultSecretProvider(
      "https://fake-vault.vault.azure.net/",
      new FakeVaultClient({}),
    );
    await expect(provider.getSecretAsync(FC_HMAC_KEY_NAME)).resolves.toBeUndefined();
    const err = await provider.getRequiredSecretAsync(FC_HMAC_KEY_NAME).catch((e) => e as Error);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain(FC_HMAC_KEY_NAME);
    expect(err.message).not.toContain(TEST_DUMMY_FC_KEY);
  });

  test("constructing without vaultUrl and without a fake throws (no silent default)", () => {
    expect(() => new KeyVaultSecretProvider("")).toThrow(/vaultUrl/i);
  });
});
