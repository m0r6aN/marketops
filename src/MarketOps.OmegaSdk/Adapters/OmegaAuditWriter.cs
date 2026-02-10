using System;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using MarketOps.OmegaSdk.Ports;
using Omega.Sdk;

namespace MarketOps.OmegaSdk.Adapters;

/// <summary>
/// Adapter for governance audit writing using omega-sdk-csharp.
///
/// ✅ SDK PRIMITIVES IMPLEMENTED (Session 5):
/// - Canonicalizer: deterministic serialization + hashing
/// - Evidence.CreateAsync(): receipt-bound evidence minting
/// - Evidence.DownloadAsync(): immutable retrieval with digest verification
///
/// This adapter now implements full audit trail functionality.
/// </summary>
public sealed class OmegaAuditWriter : IGovernanceAuditWriter
{
    private readonly OmegaClient _client;

    public OmegaAuditWriter(OmegaClient client)
    {
        _client = client ?? throw new ArgumentNullException(nameof(client));
    }

    public async Task<AuditWriteResult> WriteReceiptAndPackAsync(
        GovernanceReceiptData receipt,
        string artifactId,
        DateTimeOffset? fromUtc = null,
        DateTimeOffset? toUtc = null,
        CancellationToken ct = default)
    {
        try
        {
            // 1. CANONICALIZE receipt for deterministic hashing
            byte[] canonicalBytes = Canonicalizer.Canonicalize(receipt);
            string canonicalHash = Canonicalizer.Hash(canonicalBytes);

            // 2. BUILD evidence pack payload
            var evidencePack = new EvidencePackPayload
            {
                ReceiptId = receipt.ReceiptId,
                TenantId = receipt.TenantId,
                CorrelationId = receipt.CorrelationId,
                ArtifactId = artifactId,
                CanonicalHash = canonicalHash,
                FromUtc = fromUtc,
                ToUtc = toUtc,
                Receipt = receipt.ReceiptPayload,
                CreatedAt = DateTimeOffset.UtcNow
            };

            // 3. SERIALIZE evidence pack to bytes
            byte[] packBytes = Canonicalizer.Canonicalize(evidencePack);

            // 4. CREATE evidence via SDK
            var createRequest = new EvidenceCreateRequest
            {
                ReceiptId = receipt.ReceiptId,
                CanonicalHash = canonicalHash,
                Content = packBytes,
                TenantId = receipt.TenantId,
                CorrelationId = receipt.CorrelationId,
                Phase = "audit"
            };

            var createResponse = await _client.Evidence.CreateAsync(createRequest, ct);

            // 5. SUCCESS: Return audit write result
            return new AuditWriteResult(
                Success: true,
                ReceiptPath: $"receipt:{receipt.ReceiptId}",
                EvidencePackId: createResponse.EvidenceId,
                EvidencePackZipPath: $"evidence:{createResponse.EvidenceId}",
                ErrorCode: null,
                ErrorMessage: null);
        }
        catch (Exception ex)
        {
            // FAIL CLOSED: Any error during audit write must be reported
            return new AuditWriteResult(
                Success: false,
                ReceiptPath: null,
                EvidencePackId: null,
                EvidencePackZipPath: null,
                ErrorCode: "AUDIT_WRITE_FAILED",
                ErrorMessage: $"Failed to write audit trail: {ex.Message}");
        }
    }
}

/// <summary>
/// Evidence pack payload structure (generic, no vendor coupling).
/// </summary>
internal sealed record EvidencePackPayload
{
    public required string ReceiptId { get; init; }
    public required string TenantId { get; init; }
    public required string CorrelationId { get; init; }
    public required string ArtifactId { get; init; }
    public required string CanonicalHash { get; init; }
    public DateTimeOffset? FromUtc { get; init; }
    public DateTimeOffset? ToUtc { get; init; }
    public required object Receipt { get; init; }
    public required DateTimeOffset CreatedAt { get; init; }
}

