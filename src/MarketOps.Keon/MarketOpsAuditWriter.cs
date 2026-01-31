using System;
using System.IO;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using global::Keon.Canonicalization;
using global::Keon.Contracts.Decision;
using global::Keon.Verification;

namespace MarketOps.Keon;

public sealed class MarketOpsAuditWriter : IMarketOpsAuditWriter
{
    private readonly HttpClient _controlClient;
    private readonly string _rootPath;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public MarketOpsAuditWriter(HttpClient controlClient, string rootPath)
    {
        _controlClient = controlClient ?? throw new ArgumentNullException(nameof(controlClient));
        _rootPath = rootPath ?? throw new ArgumentNullException(nameof(rootPath));
    }

    public async Task<AuditPaths> WriteReceiptAndPackAsync(
        DecisionReceipt receipt,
        string artifactId,
        DateTimeOffset? fromUtc = null,
        DateTimeOffset? toUtc = null,
        CancellationToken ct = default)
    {
        if (receipt is null)
            throw new ArgumentNullException(nameof(receipt));
        if (string.IsNullOrWhiteSpace(artifactId))
            throw new ArgumentException("ArtifactId cannot be empty", nameof(artifactId));

        var auditRoot = BuildAuditRoot(receipt.DecidedAtUtc, artifactId);
        Directory.CreateDirectory(auditRoot);

        var receiptPath = Path.Combine(auditRoot, "decision-receipt.json");
        var canonicalBytes = KeonCanonicalJsonV1.Canonicalize(receipt);
        await File.WriteAllBytesAsync(receiptPath, canonicalBytes, ct).ConfigureAwait(false);

        var packResult = await DownloadEvidencePackAsync(
            receipt.Context.TenantId.Value,
            receipt.Context.CorrelationId.Value,
            auditRoot,
            fromUtc,
            toUtc,
            ct).ConfigureAwait(false);

        return new AuditPaths(receiptPath, packResult.PackId, packResult.ZipPath);
    }

    public async Task<EvidencePackDownload> DownloadEvidencePackAsync(
        string tenantId,
        string correlationId,
        string outputDir,
        DateTimeOffset? fromUtc = null,
        DateTimeOffset? toUtc = null,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            throw new ArgumentException("TenantId cannot be empty", nameof(tenantId));
        if (string.IsNullOrWhiteSpace(correlationId))
            throw new ArgumentException("CorrelationId cannot be empty", nameof(correlationId));
        if (string.IsNullOrWhiteSpace(outputDir))
            throw new ArgumentException("Output directory cannot be empty", nameof(outputDir));

        Directory.CreateDirectory(outputDir);

        var request = new
        {
            tenantId,
            correlationId,
            fromUtc,
            toUtc,
            requestVersion = 1
        };

        using var response = await _controlClient.PostAsJsonAsync(
            "/compliance/evidence-packs",
            request,
            cancellationToken: ct).ConfigureAwait(false);

        response.EnsureSuccessStatusCode();

        var metadata = await response.Content.ReadFromJsonAsync<EvidencePackMetadata>(_jsonOptions, ct)
            .ConfigureAwait(false);

        if (metadata == null || string.IsNullOrWhiteSpace(metadata.PackId))
            throw new InvalidOperationException("Evidence pack response missing packId.");

        var zipBytes = await _controlClient.GetByteArrayAsync(
            $"/compliance/evidence-packs/{metadata.PackId}/download",
            ct).ConfigureAwait(false);

        var zipPath = Path.Combine(outputDir, $"evidence-pack-{metadata.PackId}.zip");
        await File.WriteAllBytesAsync(zipPath, zipBytes, ct).ConfigureAwait(false);

        return new EvidencePackDownload(metadata.PackId, zipPath);
    }

    public static VerifyPackReport VerifyEvidencePack(
        string zipPath,
        string? publicKeyPath = null,
        string? trustBundlePath = null,
        DateTimeOffset? nowUtc = null,
        bool allowExpiredTrustBundle = false,
        bool allowExpiredTenantKey = false)
    {
        if (string.IsNullOrWhiteSpace(zipPath))
            throw new ArgumentException("Zip path cannot be empty", nameof(zipPath));

        var publicKey = LoadPublicKey(publicKeyPath);
        var trustBundleBytes = trustBundlePath != null ? File.ReadAllBytes(trustBundlePath) : null;

        var options = new VerifyPackOptions(
            publicKey,
            trustBundleBytes,
            nowUtc,
            allowExpiredTrustBundle,
            allowExpiredTenantKey);

        return global::Keon.Verification.VerifyPack.Run(zipPath, options);
    }

    private static byte[] LoadPublicKey(string? path)
    {
        var keyText = path != null ? File.ReadAllText(path) : Environment.GetEnvironmentVariable("KEON_SIGNING_PUBLIC_KEY_B64");
        if (string.IsNullOrWhiteSpace(keyText))
            throw new InvalidOperationException("Missing public key material.");

        var trimmed = keyText.Trim();
        var publicKey = Convert.FromBase64String(trimmed);
        if (publicKey.Length != 32)
            throw new InvalidOperationException("Ed25519 public key must be 32 bytes.");

        return publicKey;
    }

    private string BuildAuditRoot(DateTimeOffset decidedAtUtc, string artifactId)
    {
        var date = decidedAtUtc.UtcDateTime.ToString("yyyy-MM-dd");
        return Path.Combine(_rootPath, "assets", "publish", date, artifactId);
    }

    public sealed record AuditPaths(string ReceiptPath, string PackId, string PackZipPath);

    public sealed record EvidencePackDownload(string PackId, string ZipPath);

    private sealed record EvidencePackMetadata(string PackId);
}
