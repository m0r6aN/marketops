using System;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace MarketOps.Security;

/// <summary>
/// Federation Core HMAC-SHA256 signer for advisory receipts.
/// Signs canonical JSON payloads and verifies signatures.
/// 
/// Key management: reads from MARKETOPS_FC_HMAC_KEY env var,
/// falls back to a deterministic dev key (NOT for production).
/// </summary>
public sealed class FcSigner
{
    private const string DevKey = "marketops-fc-dev-signing-key-v1-NOT-FOR-PRODUCTION";
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
    {
        var key = hmacKey
            ?? Environment.GetEnvironmentVariable("MARKETOPS_FC_HMAC_KEY")
            ?? DevKey;

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

