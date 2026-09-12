namespace MarketOps.Security;

/// <summary>
/// Secret provider abstraction (fail-closed).
/// Local: <see cref="EnvSecretProvider"/> reads environment variables.
/// Beta: <see cref="KeyVaultSecretProvider"/> reads Azure Key Vault with managed identity.
/// Rules: never commit secrets, never log secret values (errors name the variable only),
/// no DevKey/fallback/default-secret — missing key throws.
/// </summary>
public interface ISecretProvider
{
    /// <summary>Returns the secret value, or null when missing/empty. Never throws for missing.</summary>
    string? GetSecret(string name);

    /// <summary>Returns the secret value or throws <see cref="InvalidOperationException"/> when missing/empty.</summary>
    string GetRequiredSecret(string name);
}
