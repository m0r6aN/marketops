using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace Omega.Sdk;

public sealed class OmegaOptions
{
    public string? FederationUrl { get; set; }
}

public sealed class OmegaClient
{
    public OmegaClient(OmegaOptions? options = null)
    {
        Options = options ?? new OmegaOptions();
        Tools = new ToolsClient();
        Evidence = new EvidenceClient();
    }

    public OmegaOptions Options { get; }

    public ToolsClient Tools { get; }

    public EvidenceClient Evidence { get; }
}

public sealed class ToolsClient
{
    public Task<ToolInvocationResult> InvokeAsync(
        string toolId,
        Dictionary<string, object> input,
        string? tenantId = null,
        string? actorId = null,
        string? correlationId = null,
        string? decisionReceiptId = null,
        CancellationToken cancellationToken = default)
    {
        throw new NotSupportedException("Omega.Sdk stub cannot invoke tools.");
    }
}

public sealed class EvidenceClient
{
    private readonly Dictionary<string, EvidenceRecord> _storage = new();
    private int _nextId = 1;

    public Task<OmegaEvidenceVerificationResult> VerifyAsync(
        string packHash,
        string? tenantId = null,
        string? actorId = null,
        string? correlationId = null,
        CancellationToken cancellationToken = default)
    {
        throw new NotSupportedException("Omega.Sdk stub cannot verify evidence.");
    }

    /// <summary>
    /// Create evidence bound to a receipt.
    /// </summary>
    public Task<EvidenceCreateResponse> CreateAsync(
        EvidenceCreateRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request is null)
            throw new ArgumentNullException(nameof(request));

        if (string.IsNullOrWhiteSpace(request.ReceiptId))
            throw new ArgumentException("ReceiptId is required", nameof(request));

        if (request.Content is null || request.Content.Length == 0)
            throw new ArgumentException("Content is required", nameof(request));

        // Generate evidence ID
        string evidenceId = $"evidence-{_nextId++:D6}";

        // Compute digest
        string digest = Canonicalizer.Hash(request.Content);

        // Store evidence record
        var record = new EvidenceRecord
        {
            EvidenceId = evidenceId,
            ReceiptId = request.ReceiptId,
            CanonicalHash = request.CanonicalHash,
            Content = request.Content,
            Digest = digest,
            CreatedAt = DateTimeOffset.UtcNow,
            TenantId = request.TenantId,
            CorrelationId = request.CorrelationId,
            Phase = request.Phase
        };

        _storage[evidenceId] = record;

        return Task.FromResult(new EvidenceCreateResponse
        {
            EvidenceId = evidenceId,
            Digest = digest,
            CreatedAt = record.CreatedAt
        });
    }

    /// <summary>
    /// Download evidence by ID with digest verification.
    /// </summary>
    public Task<EvidenceDownloadResponse> DownloadAsync(
        EvidenceDownloadRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request is null)
            throw new ArgumentNullException(nameof(request));

        if (string.IsNullOrWhiteSpace(request.EvidenceId))
            throw new ArgumentException("EvidenceId is required", nameof(request));

        // Retrieve evidence
        if (!_storage.TryGetValue(request.EvidenceId, out var record))
        {
            throw new InvalidOperationException($"Evidence not found: {request.EvidenceId}");
        }

        // Verify digest if provided
        if (!string.IsNullOrEmpty(request.ExpectedDigest))
        {
            if (!string.Equals(record.Digest, request.ExpectedDigest, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException(
                    $"Digest mismatch for evidence {request.EvidenceId}. " +
                    $"Expected: {request.ExpectedDigest}, Actual: {record.Digest}");
            }
        }

        return Task.FromResult(new EvidenceDownloadResponse
        {
            EvidenceId = record.EvidenceId,
            Content = record.Content,
            Digest = record.Digest,
            CreatedAt = record.CreatedAt,
            ReceiptId = record.ReceiptId,
            CanonicalHash = record.CanonicalHash
        });
    }
}

internal sealed class EvidenceRecord
{
    public required string EvidenceId { get; init; }
    public required string ReceiptId { get; init; }
    public string? CanonicalHash { get; init; }
    public required byte[] Content { get; init; }
    public required string Digest { get; init; }
    public required DateTimeOffset CreatedAt { get; init; }
    public string? TenantId { get; init; }
    public string? CorrelationId { get; init; }
    public string? Phase { get; init; }
}

public sealed class EvidenceCreateRequest
{
    public required string ReceiptId { get; init; }
    public string? CanonicalHash { get; init; }
    public required byte[] Content { get; init; }
    public string? TenantId { get; init; }
    public string? CorrelationId { get; init; }
    public string? Phase { get; init; }
}

public sealed class EvidenceCreateResponse
{
    public required string EvidenceId { get; init; }
    public required string Digest { get; init; }
    public required DateTimeOffset CreatedAt { get; init; }
}

public sealed class EvidenceDownloadRequest
{
    public required string EvidenceId { get; init; }
    public string? ExpectedDigest { get; init; }
}

public sealed class EvidenceDownloadResponse
{
    public required string EvidenceId { get; init; }
    public required byte[] Content { get; init; }
    public required string Digest { get; init; }
    public required DateTimeOffset CreatedAt { get; init; }
    public string? ReceiptId { get; init; }
    public string? CanonicalHash { get; init; }
}

public sealed class ToolInvocationResult
{
    public AuditRecord? Audit { get; init; }

    public object? Result { get; init; }
}

public sealed class AuditRecord
{
    public string? ReceiptId { get; init; }
}

public sealed class OmegaEvidenceVerificationResult
{
    public bool IsValid { get; init; }

    public string? Verdict { get; init; }
}
