using System;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Azure.Core;
using Azure.Security.KeyVault.Secrets;

namespace MarketOps.Security;

/// <summary>
/// Minimal Key Vault client surface (lets tests inject a fake — no network).
/// </summary>
public interface IKeyVaultSecretClient
{
    /// <summary>Returns the vault secret value, or null when missing.</summary>
    string? GetSecret(string vaultSecretName);
}

/// <summary>
/// Azure Key Vault secret provider (beta, managed identity; locally unconstructed).
/// Beta-wired: construct ONLY in Container Apps with a managed identity.
/// Local dev uses <see cref="EnvSecretProvider"/>. Tests inject <see cref="IKeyVaultSecretClient"/> fake.
/// Key Vault secret names use dashes: env `MARKETOPS_FC_HMAC_KEY` &lt;-&gt; vault `marketops-fc-hmac-key`.
/// Never logs secret values.
/// </summary>
public sealed class KeyVaultSecretProvider : ISecretProvider
{
    private readonly IKeyVaultSecretClient _client;

    /// <summary>
    /// Creates a provider backed by Azure Key Vault at <paramref name="vaultUri"/>
    /// using managed identity (IMDS, no Azure.Identity dependency).
    /// </summary>
    public KeyVaultSecretProvider(string vaultUri)
        : this(vaultUri, client: null, credential: null)
    {
    }

    internal KeyVaultSecretProvider(string vaultUri, IKeyVaultSecretClient? client, TokenCredential? credential)
    {
        if (client is not null)
        {
            _client = client;
            return;
        }
        if (string.IsNullOrWhiteSpace(vaultUri))
            throw new InvalidOperationException(
                "Key Vault vaultUri is not set. Configure MARKETOPS_KEY_VAULT_URL (beta).");
        var secretClient = new SecretClient(
            new Uri(vaultUri),
            credential ?? new ManagedIdentityTokenCredential());
        _client = new SecretClientAdapter(secretClient);
    }

    /// <summary>Test/DI hook: wraps an already-built client (or fake). No network on construct.</summary>
    public KeyVaultSecretProvider(IKeyVaultSecretClient client)
    {
        _client = client ?? throw new ArgumentNullException(nameof(client));
    }

    public static string ToVaultSecretName(string envName)
        => envName.ToLowerInvariant().Replace("_", "-");

    public string? GetSecret(string name)
    {
        var vaultName = ToVaultSecretName(name);
        return _client.GetSecret(vaultName);
    }

    public string GetRequiredSecret(string name)
    {
        var value = GetSecret(name);
        if (string.IsNullOrWhiteSpace(value))
            throw EnvSecretProvider_Missing(name);
        return value!;
    }

    private static InvalidOperationException EnvSecretProvider_Missing(string name)
        => new InvalidOperationException(
            $"{name} is not set. Set it in the environment (.env.local locally) or configure Azure Key Vault (beta). Refusing to start with a fallback key.");

    private sealed class SecretClientAdapter : IKeyVaultSecretClient
    {
        private readonly SecretClient _inner;
        public SecretClientAdapter(SecretClient inner) => _inner = inner;

        public string? GetSecret(string vaultSecretName)
        {
            try
            {
                var response = _inner.GetSecret(vaultSecretName);
                var value = response?.Value?.Value;
                return string.IsNullOrWhiteSpace(value) ? null : value;
            }
            catch (Azure.RequestFailedException ex) when (ex.Status == 404)
            {
                return null;
            }
        }
    }
}

/// <summary>
/// Managed-identity <see cref="TokenCredential"/> via the Azure IMDS endpoint.
/// Avoids an Azure.Identity package dependency (only Azure.Security.KeyVault.Secrets is referenced).
/// Never logs tokens.
/// </summary>
internal sealed class ManagedIdentityTokenCredential : TokenCredential
{
    private static readonly HttpClient Http = new();
    private const string ScopeResource = "https://vault.azure.net";

    public override AccessToken GetToken(TokenRequestContext requestContext, CancellationToken cancellationToken)
        => GetTokenAsync(requestContext, cancellationToken).GetAwaiter().GetResult();

    public override async ValueTask<AccessToken> GetTokenAsync(TokenRequestContext requestContext, CancellationToken cancellationToken)
    {
        var resource = ScopeResource;
        if (requestContext.Scopes is { Length: > 0 } scopes && !string.IsNullOrWhiteSpace(scopes[0]))
        {
            // Scope is typically "https://vault.azure.net/.default" — strip the suffix.
            resource = scopes[0].Replace("/.default", "", StringComparison.OrdinalIgnoreCase);
        }
        var url = $"http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource={Uri.EscapeDataString(resource)}";
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Add("Metadata", "true");
        using var res = await Http.SendAsync(req, cancellationToken).ConfigureAwait(false);
        res.EnsureSuccessStatusCode();
        using var stream = await res.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken).ConfigureAwait(false);
        var token = doc.RootElement.GetProperty("access_token").GetString();
        var expiresOnRaw = doc.RootElement.TryGetProperty("expires_on", out var e) ? e.GetString() : null;
        if (string.IsNullOrEmpty(token))
            throw new InvalidOperationException("Managed identity endpoint returned no access_token.");
        var expiresOn = DateTimeOffset.UtcNow.AddMinutes(50);
        if (long.TryParse(expiresOnRaw, out var epoch))
            expiresOn = DateTimeOffset.FromUnixTimeSeconds(epoch);
        return new AccessToken(token, expiresOn);
    }
}
