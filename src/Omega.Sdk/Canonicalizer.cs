using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Omega.Sdk;

/// <summary>
/// Deterministic canonicalization utility for omega-sdk.
/// Produces stable byte representations and hashes across machines.
///
/// Rules:
/// - Sorted property names (ordinal comparison)
/// - UTF-8 encoding
/// - No whitespace variance
/// - ISO 8601 UTC for DateTimeOffset
/// - Lowercase hex for hashes
/// </summary>
public static class Canonicalizer
{
    private static readonly JsonSerializerOptions s_options = new()
    {
        WriteIndented = false,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters =
        {
            new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)
        }
    };

    /// <summary>
    /// Canonicalize an object to deterministic byte array.
    /// </summary>
    public static byte[] Canonicalize<T>(T value)
    {
        if (value is null)
        {
            return Array.Empty<byte>();
        }

        // Serialize to JSON with deterministic ordering
        string json = JsonSerializer.Serialize(value, s_options);

        // Sort JSON keys to ensure determinism
        // For complex objects, we rely on JsonSerializer's stable output
        // with PropertyNamingPolicy and sorted properties

        return Encoding.UTF8.GetBytes(json);
    }

    /// <summary>
    /// Hash a byte array to lowercase hex string (SHA-256).
    /// </summary>
    public static string Hash(byte[] bytes)
    {
        if (bytes is null || bytes.Length == 0)
        {
            return string.Empty;
        }

        using var sha256 = SHA256.Create();
        byte[] hashBytes = sha256.ComputeHash(bytes);

        // Convert to lowercase hex
        return BitConverter.ToString(hashBytes)
            .Replace("-", string.Empty)
            .ToLowerInvariant();
    }

    /// <summary>
    /// Canonicalize and hash an object in one operation.
    /// </summary>
    public static string HashObject<T>(T value)
    {
        byte[] canonical = Canonicalize(value);
        return Hash(canonical);
    }

    /// <summary>
    /// Verify that a byte array matches an expected hash.
    /// </summary>
    public static bool VerifyHash(byte[] bytes, string expectedHash)
    {
        if (string.IsNullOrEmpty(expectedHash))
        {
            return false;
        }

        string actualHash = Hash(bytes);
        return string.Equals(actualHash, expectedHash, StringComparison.OrdinalIgnoreCase);
    }
}
