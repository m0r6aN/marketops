using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using NSec.Cryptography;

namespace MarketOps.Security;

/// <summary>
/// Ed25519 asymmetric signer for Proof Pack manifest signing.
/// Provides portable provenance — proves "this specific issuer signed it"
/// without sharing secrets.
///
/// Key management:
///   - Private key: loaded from file or env var MARKETOPS_ED25519_PRIVATE_KEY_PATH
///   - Public key: derived from private key, shipped with the pack
///   - Dev mode: generates ephemeral keypair if no key file exists
///
/// Key ID format: keon.marketops.proofpack.ed25519.v1:{fingerprint}
///   where fingerprint = first 16 chars of sha256(publicKeyBytes)
/// </summary>
public sealed class Ed25519Signer : IDisposable
{
    private const string KeyIdPrefix = "keon.marketops.proofpack.ed25519.v1";
    private static readonly SignatureAlgorithm Algorithm = SignatureAlgorithm.Ed25519;

    private readonly Key _privateKey;
    private readonly PublicKey _publicKey;
    private readonly byte[] _publicKeyBytes;
    private readonly string _fingerprint;
    private readonly string _keyId;

    public string KeyId => _keyId;
    public string Fingerprint => _fingerprint;
    public byte[] PublicKeyBytes => (byte[])_publicKeyBytes.Clone();

    /// <summary>
    /// Creates a new Ed25519Signer. Loads key from file if available,
    /// otherwise generates a new ephemeral dev keypair.
    /// </summary>
    public Ed25519Signer(string? privateKeyPath = null)
    {
        var keyPath = privateKeyPath
            ?? Environment.GetEnvironmentVariable("MARKETOPS_ED25519_PRIVATE_KEY_PATH");

        if (keyPath != null && File.Exists(keyPath))
        {
            // Load existing private key
            var keyBytes = File.ReadAllBytes(keyPath);
            _privateKey = Key.Import(Algorithm, keyBytes, KeyBlobFormat.NSecPrivateKey,
                new KeyCreationParameters { ExportPolicy = KeyExportPolicies.AllowPlaintextArchiving });
        }
        else
        {
            // Generate ephemeral dev keypair
            _privateKey = Key.Create(Algorithm,
                new KeyCreationParameters { ExportPolicy = KeyExportPolicies.AllowPlaintextArchiving });

            // Save to default location if we generated a new one
            var defaultPath = keyPath ?? Path.Combine(
                AppContext.BaseDirectory, "proofpack_signing_private.ed25519");
            var exportedKey = _privateKey.Export(KeyBlobFormat.NSecPrivateKey);
            Directory.CreateDirectory(Path.GetDirectoryName(defaultPath)!);
            File.WriteAllBytes(defaultPath, exportedKey);
        }

        _publicKey = _privateKey.PublicKey;
        _publicKeyBytes = _publicKey.Export(KeyBlobFormat.RawPublicKey);
        _fingerprint = ComputeFingerprint(_publicKeyBytes);
        _keyId = $"{KeyIdPrefix}:{_fingerprint}";
    }

    /// <summary>
    /// Signs data bytes with the Ed25519 private key.
    /// Returns the signature as a Base64 string.
    /// </summary>
    public string Sign(byte[] data)
    {
        var signature = Algorithm.Sign(_privateKey, data);
        return Convert.ToBase64String(signature);
    }

    /// <summary>
    /// Signs canonical JSON string (UTF-8 bytes, no BOM).
    /// Returns the signature as a Base64 string.
    /// </summary>
    public string SignCanonical(string canonicalJson)
    {
        var bytes = Encoding.UTF8.GetBytes(canonicalJson);
        return Sign(bytes);
    }

    /// <summary>
    /// Verifies an Ed25519 signature against data bytes.
    /// </summary>
    public static bool Verify(byte[] publicKeyBytes, byte[] data, byte[] signature)
    {
        var pubKey = PublicKey.Import(Algorithm, publicKeyBytes, KeyBlobFormat.RawPublicKey);
        return Algorithm.Verify(pubKey, data, signature);
    }

    /// <summary>
    /// Verifies a Base64-encoded signature against canonical JSON.
    /// </summary>
    public bool VerifyCanonical(string canonicalJson, string base64Signature)
    {
        var data = Encoding.UTF8.GetBytes(canonicalJson);
        var sig = Convert.FromBase64String(base64Signature);
        return Verify(_publicKeyBytes, data, sig);
    }

    /// <summary>
    /// Writes the raw public key bytes to the specified file path.
    /// Used to ship the public key with the Proof Pack (keys/ folder).
    /// </summary>
    public void WritePublicKey(string path)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllBytes(path, _publicKeyBytes);
    }

    /// <summary>
    /// Computes the key fingerprint: sha256(publicKeyBytes) → lowercase hex, first 16 chars.
    /// </summary>
    public static string ComputeFingerprint(byte[] publicKeyBytes)
    {
        using var sha = SHA256.Create();
        var hash = sha.ComputeHash(publicKeyBytes);
        var fullHex = Convert.ToHexString(hash).ToLowerInvariant();
        return fullHex[..16];
    }

    public void Dispose()
    {
        _privateKey?.Dispose();
    }
}

