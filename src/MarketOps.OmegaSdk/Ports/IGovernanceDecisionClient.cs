using System.Threading;
using System.Threading.Tasks;

namespace MarketOps.OmegaSdk.Ports;

/// <summary>
/// Port for governance decision operations.
/// Generic interface - no Keon-specific types.
/// </summary>
public interface IGovernanceDecisionClient
{
    Task<GovernanceDecisionResult> DecideAsync(
        GovernanceDecisionRequest request,
        CancellationToken ct = default);
}

/// <summary>
/// Generic governance decision request.
/// </summary>
public sealed record GovernanceDecisionRequest(
    string TenantId,
    string ActorId,
    string CorrelationId,
    string Capability,
    Dictionary<string, object?> Input,
    Dictionary<string, object?>? Context = null);

/// <summary>
/// Generic governance decision result.
/// </summary>
public sealed record GovernanceDecisionResult(
    bool Success,
    string? ReceiptId,
    string? Outcome,
    DateTimeOffset? DecidedAtUtc,
    string? ErrorCode = null,
    string? ErrorMessage = null);

