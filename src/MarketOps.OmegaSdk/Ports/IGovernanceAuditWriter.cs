using System;
using System.Threading;
using System.Threading.Tasks;

namespace MarketOps.OmegaSdk.Ports;

/// <summary>
/// Port for governance audit writing operations.
/// Generic interface - no vendor-specific types.
/// </summary>
public interface IGovernanceAuditWriter
{
    Task<AuditWriteResult> WriteReceiptAndPackAsync(
        GovernanceReceiptData receipt,
        string artifactId,
        DateTimeOffset? fromUtc = null,
        DateTimeOffset? toUtc = null,
        CancellationToken ct = default);
}

/// <summary>
/// Generic governance receipt data for audit trail.
/// </summary>
public sealed record GovernanceReceiptData(
    string ReceiptId,
    string TenantId,
    string CorrelationId,
    string Outcome,
    DateTimeOffset DecidedAtUtc,
    object ReceiptPayload);

/// <summary>
/// Result of audit write operation.
/// </summary>
public sealed record AuditWriteResult(
    bool Success,
    string? ReceiptPath,
    string? EvidencePackId,
    string? EvidencePackZipPath,
    string? ErrorCode = null,
    string? ErrorMessage = null);

