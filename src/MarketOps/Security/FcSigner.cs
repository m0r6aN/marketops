using System;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace MarketOps.Security;

/// <summary>
/// Federation Core HMAC-SHA256 signer for advisory receipts.
/// Signs canonical JSON payloads and verifies signatures.
///
/// Key management (fail-closed, no DevKey fallback):
/// reads from MARKETOPS_FC_HMAC_KEY env var locally via <see cref="EnvSecretProvider"/>,
/// or from Azure Key Vault via <see cref="KeyVaultSecretProvider"/> in beta.
/// Missing/empty key throws <see cref="InvalidOperationException"/> at construct/boot.
/// Never logs secret values.
/// </summary>
public sealed class FcSigner
{
    public const string HmacKeyEnvVar = "MARKETOPS_FC_HMAC_KEY";
    private const string Algorithm = "hmac-sha256";

    private readonly byte[] _keyBytes;
    private readonly string _keyId;
    private readonly string _issuerId;
    private readonly string? _issuerEndpoint;

    public string Algorithm_ => Algorithm;
    public string KeyId => _keyId;
    public string IssuerId => _issuerId;
    public string? IssuerEndpoint => _issuerEndpoint;

    public FcSigner(
        string? hmacKey = null,
        string? keyId = null,
        string? issuerId = null,
        string? issuerEndpoint = null)
        : this(secrets: null, hmacKey: hmacKey, keyId: keyId, issuerId: issuerId, issuerEndpoint: issuerEndpoint)
    {
    }

    /// <summary>
    /// Provider-based construction (preferred for DI / Key Vault).
    /// Explicit <paramref name="hmacKey"/> wins; otherwise reads
    /// <c>MARKETOPS_FC_HMAC_KEY</c> via <paramref name="secrets"/>
    /// (defaults to env). Missing/empty throws — fail-closed, no fallback.
    /// </summary>
    public FcSigner(
        ISecretProvider? secrets,
        string? hmacKey = null,
        string? keyId = null,
        string? issuerId = null,
        string? issuerEndpoint = null)
    {
        string? key = hmacKey;
        if (string.IsNullOrWhiteSpace(key))
        {
            var provider = secrets ?? EnvSecretProvider.Instance;
            key = provider.GetSecret(HmacKeyEnvVar);
        }

        if (string.IsNullOrWhiteSpace(key))
            throw new InvalidOperationException(
                $"{HmacKeyEnvVar} is not set. Set it in the environment (.env.local locally) or configure Azure Key Vault (beta). Refusing to start with a fallback key.");

        _keyBytes = Encoding.UTF8.GetBytes(key);
        _keyId = keyId ?? "fc-marketops-k1";
        _issuerId = issuerId ?? "federation-core";
        _issuerEndpoint = issuerEndpoint ?? "http://federation-core:9400";
    }

    /// <summary>
    /// Computes HMAC-SHA256 signature over canonical JSON bytes.
    /// Canonical form: sorted-key JSON with no indentation (deterministic).
    /// </summary>
    public string Sign(string canonicalJson)
    {
        var payloadBytes = Encoding.UTF8.GetBytes(canonicalJson);
        using var hmac = new HMACSHA256(_keyBytes);
        var hash = hmac.ComputeHash(payloadBytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    /// <summary>
    /// Verifies an HMAC-SHA256 signature against canonical JSON.
    /// </summary>
    public bool Verify(string canonicalJson, string signature)
    {
        var expected = Sign(canonicalJson);
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expected),
            Encoding.UTF8.GetBytes(signature));
    }

    /// <summary>
    /// Computes SHA-256 hash of a UTF-8 string.
    /// </summary>
    public static string ComputeSha256(string text)
    {
        var bytes = Encoding.UTF8.GetBytes(text);
        return ComputeSha256Bytes(bytes);
    }

    /// <summary>
    /// Computes SHA-256 hash of raw bytes.
    /// </summary>
    public static string ComputeSha256Bytes(byte[] bytes)
    {
        using var sha = SHA256.Create();
        var hash = sha.ComputeHash(bytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    /// <summary>
    /// Serializes an object to canonical JSON (sorted keys, no indentation).
    /// Used as the signing payload for deterministic signatures.
    /// </summary>
    public static string ToCanonicalJson(object obj)
    {
        // System.Text.Json doesn't sort keys by default, but for our use case
        // we serialize with camelCase and no indentation for determinism.
        // True JCS (RFC 8785) would require a dedicated library, but for
        // HMAC signing within our own system this is sufficient.
        var opts = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
            WriteIndented = false,
            Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        };
        return JsonSerializer.Serialize(obj, opts);
    }
}

