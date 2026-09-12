using System;

namespace MarketOps.Security;

/// <summary>
/// Environment-variable secret provider (local).
/// No defaults, no fallback: missing/empty throws <see cref="InvalidOperationException"/>.
/// Error messages name the variable only — never include secret values.
/// </summary>
public sealed class EnvSecretProvider : ISecretProvider
{
    public static readonly EnvSecretProvider Instance = new();

    public string? GetSecret(string name)
    {
        var value = Environment.GetEnvironmentVariable(name);
        if (string.IsNullOrWhiteSpace(value))
            return null;
        return value;
    }

    public string GetRequiredSecret(string name)
    {
        var value = GetSecret(name);
        if (value is null)
            throw MissingSecret(name);
        return value;
    }

    internal static InvalidOperationException MissingSecret(string name)
        => new InvalidOperationException(
            $"{name} is not set. Set it in the environment (.env.local locally) or configure Azure Key Vault (beta). Refusing to start with a fallback key.");
}
