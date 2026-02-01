using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace MarketOps.OmegaSdk.Ports;

/// <summary>
/// Port for governance execution operations.
/// Generic interface - no vendor-specific types.
/// </summary>
public interface IGovernanceExecutionClient
{
    Task<GovernanceExecutionResult> ExecuteAsync(
        GovernanceExecutionRequest request,
        CancellationToken ct = default);
}

/// <summary>
/// Generic governance execution request.
/// </summary>
public sealed record GovernanceExecutionRequest(
    string TenantId,
    string ActorId,
    string CorrelationId,
    string DecisionReceiptId,
    string Target,
    Dictionary<string, object?> Parameters);

/// <summary>
/// Generic governance execution result.
/// </summary>
public sealed record GovernanceExecutionResult(
    bool Success,
    string? ExecutionId,
    string? Status,
    DateTimeOffset? ExecutedAtUtc,
    Dictionary<string, object?>? Output = null,
    string? ErrorCode = null,
    string? ErrorMessage = null);

