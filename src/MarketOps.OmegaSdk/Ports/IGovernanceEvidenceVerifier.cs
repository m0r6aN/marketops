using System;
using System.Threading;
using System.Threading.Tasks;

namespace MarketOps.OmegaSdk.Ports;

/// <summary>
/// Port for governance evidence verification operations.
/// Generic interface - no vendor-specific types.
/// </summary>
public interface IGovernanceEvidenceVerifier
{
    Task<EvidenceVerificationResult> VerifyAsync(
        string packHash,
        string? tenantId = null,
        string? actorId = null,
        string? correlationId = null,
        CancellationToken ct = default);
}

/// <summary>
/// Result of evidence verification.
/// </summary>
public sealed record EvidenceVerificationResult(
    bool Success,
    bool IsValid,
    string? Verdict,
    int? Phase,
    string[]? ErrorCodes = null,
    string? ErrorMessage = null);

