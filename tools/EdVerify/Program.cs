// EdVerify — Ed25519 signature verification tool for MarketOps Proof Pack.
// Called by VERIFY.ps1 to verify manifest signatures.
//
// Subcommands:
//   EdVerify verify          --pub <keyfile> --sig <base64> --in <datafile>
//   EdVerify verify-manifest --pub <keyfile> --manifest <manifestfile>
//
// verify-manifest reads RUN_MANIFEST.json, strips the manifestSignature property,
// canonicalizes using Utf8JsonWriter (compact, preserving property order), and
// verifies the Ed25519 signature embedded in the manifest.
//
// Exit codes:
//   0 = signature valid
//   1 = signature invalid or verification error
//   2 = usage error (missing args, files not found)

using System;
using System.IO;
using System.Text;
using System.Text.Json;
using NSec.Cryptography;

if (args.Length < 1)
{
    PrintUsage();
    return 2;
}

return args[0] switch
{
    "verify" => RunVerify(args),
    "verify-manifest" => RunVerifyManifest(args),
    _ => PrintUsage()
};

static int PrintUsage()
{
    Console.Error.WriteLine("Usage:");
    Console.Error.WriteLine("  EdVerify verify          --pub <keyfile> --sig <base64> --in <datafile>");
    Console.Error.WriteLine("  EdVerify verify-manifest --pub <keyfile> --manifest <manifestfile>");
    return 2;
}

static int RunVerify(string[] args)
{
    string? pubPath = null, sig = null, dataPath = null;
    for (int i = 1; i < args.Length; i++)
    {
        switch (args[i])
        {
            case "--pub" when i + 1 < args.Length: pubPath = args[++i]; break;
            case "--sig" when i + 1 < args.Length: sig = args[++i]; break;
            case "--in" when i + 1 < args.Length: dataPath = args[++i]; break;
        }
    }
    if (pubPath == null || sig == null || dataPath == null)
    {
        Console.Error.WriteLine("Error: --pub, --sig, and --in are all required.");
        return 2;
    }
    if (!File.Exists(pubPath)) { Console.Error.WriteLine($"Error: Public key file not found: {pubPath}"); return 2; }
    if (!File.Exists(dataPath)) { Console.Error.WriteLine($"Error: Data file not found: {dataPath}"); return 2; }

    try
    {
        var algorithm = SignatureAlgorithm.Ed25519;
        var publicKey = PublicKey.Import(algorithm, File.ReadAllBytes(pubPath), KeyBlobFormat.RawPublicKey);
        var sigBytes = Convert.FromBase64String(sig);
        return VerifySignature(algorithm, publicKey, File.ReadAllBytes(dataPath), sigBytes);
    }
    catch (Exception ex) { Console.Error.WriteLine($"FAIL: {ex.Message}"); return 1; }
}

static int RunVerifyManifest(string[] args)
{
    string? pubPath = null, manifestPath = null;
    for (int i = 1; i < args.Length; i++)
    {
        switch (args[i])
        {
            case "--pub" when i + 1 < args.Length: pubPath = args[++i]; break;
            case "--manifest" when i + 1 < args.Length: manifestPath = args[++i]; break;
        }
    }
    if (pubPath == null || manifestPath == null)
    {
        Console.Error.WriteLine("Error: --pub and --manifest are required.");
        return 2;
    }
    if (!File.Exists(pubPath)) { Console.Error.WriteLine($"Error: Public key file not found: {pubPath}"); return 2; }
    if (!File.Exists(manifestPath)) { Console.Error.WriteLine($"Error: Manifest file not found: {manifestPath}"); return 2; }

    try
    {
        var manifestJson = File.ReadAllText(manifestPath, Encoding.UTF8);
        var doc = JsonDocument.Parse(manifestJson);
        var root = doc.RootElement;

        // Extract signature from manifestSignature.signature
        if (!root.TryGetProperty("manifestSignature", out var sigProp))
        {
            Console.Error.WriteLine("FAIL: manifest has no manifestSignature property.");
            return 1;
        }
        var base64Sig = sigProp.GetProperty("signature").GetString()!;

        // Canonicalize: iterate properties in order, skip manifestSignature, write compact JSON
        // CRITICAL: Use UnsafeRelaxedJsonEscaping to match FcSigner.ToCanonicalJson encoding.
        // Without this, WriteTo escapes '+' as '\u002B' in DateTimeOffset strings, but
        // JsonSerializer.Serialize writes literal '+' (bypasses encoder for DateTimeOffset).
        using var ms = new MemoryStream();
        using (var writer = new Utf8JsonWriter(ms, new JsonWriterOptions
        {
            Indented = false,
            Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        }))
        {
            writer.WriteStartObject();
            foreach (var prop in root.EnumerateObject())
            {
                if (prop.Name != "manifestSignature")
                    prop.WriteTo(writer);
            }
            writer.WriteEndObject();
        }
        var canonicalBytes = ms.ToArray();

        // Verify
        var algorithm = SignatureAlgorithm.Ed25519;
        var publicKey = PublicKey.Import(algorithm, File.ReadAllBytes(pubPath), KeyBlobFormat.RawPublicKey);
        var sigBytes = Convert.FromBase64String(base64Sig);
        return VerifySignature(algorithm, publicKey, canonicalBytes, sigBytes);
    }
    catch (Exception ex) { Console.Error.WriteLine($"FAIL: {ex.Message}"); return 1; }
}

static int VerifySignature(SignatureAlgorithm algorithm, PublicKey publicKey, byte[] data, byte[] signature)
{
    if (algorithm.Verify(publicKey, data, signature))
    {
        Console.WriteLine("OK: Ed25519 signature verified.");
        return 0;
    }
    Console.Error.WriteLine("FAIL: Ed25519 signature verification failed.");
    return 1;
}
