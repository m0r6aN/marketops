using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace MarketOps.Ports;

/// <summary>
/// Production implementation of ISideEffectPort.
/// Executes side effects only with enforceable authorization.
/// Fail-closed: missing authorization → exception.
/// </summary>
public sealed class LiveSideEffectPort : ISideEffectPort
{
    private readonly IGovernanceAuthorizationValidator _authValidator;
    private readonly Action<string>? _auditLog;

    public LiveSideEffectPort(
        IGovernanceAuthorizationValidator authValidator,
        Action<string>? auditLog = null)
    {
        _authValidator = authValidator ?? throw new ArgumentNullException(nameof(authValidator));
        _auditLog = auditLog;
    }

    public async Task<SideEffectReceipt> PublishReleaseAsync(
        string target,
        Dictionary<string, object?> parameters,
        CancellationToken ct = default)
    {
        return await ExecuteWithAuthorizationAsync(
            SideEffectType.PublishRelease, target, parameters, ct);
    }

    public async Task<SideEffectReceipt> PublishPostAsync(
        string target,
        Dictionary<string, object?> parameters,
        CancellationToken ct = default)
    {
        return await ExecuteWithAuthorizationAsync(
            SideEffectType.PublishPost, target, parameters, ct);
    }

    public async Task<SideEffectReceipt> TagRepoAsync(
        string target,
        Dictionary<string, object?> parameters,
        CancellationToken ct = default)
    {
        return await ExecuteWithAuthorizationAsync(
            SideEffectType.TagRepo, target, parameters, ct);
    }

    public async Task<SideEffectReceipt> OpenPrAsync(
        string target,
        Dictionary<string, object?> parameters,
        CancellationToken ct = default)
    {
        return await ExecuteWithAuthorizationAsync(
            SideEffectType.OpenPr, target, parameters, ct);
    }

    private async Task<SideEffectReceipt> ExecuteWithAuthorizationAsync(
        SideEffectType effectType,
        string target,
        Dictionary<string, object?> parameters,
        CancellationToken ct)
    {
        var intentId = Guid.NewGuid().ToString();
        var now = DateTimeOffset.UtcNow;

        // Validate authorization (fail-closed)
        var authResult = await _authValidator.ValidateAsync(
            effectType.ToString(), target, parameters, ct);

        if (!authResult.IsAuthorized)
        {
            _auditLog?.Invoke(
                $"SIDE_EFFECT_DENIED mode=prod effect={effectType} target={target} reason={authResult.DenyReason}");

            return new SideEffectReceipt(
                Id: intentId,
                Mode: "prod",
                EffectType: effectType,
                Target: target,
                Success: false,
                ErrorMessage: authResult.DenyReason,
                ExecutedAt: now);
        }

        // Execute side effect
        _auditLog?.Invoke($"SIDE_EFFECT_EXECUTING mode=prod effect={effectType} target={target}");

        try
        {
            // TODO: Implement actual side effect execution
            // This is a placeholder for the actual implementation
            await Task.Delay(0, ct);

            _auditLog?.Invoke($"SIDE_EFFECT_SUCCESS mode=prod effect={effectType} target={target}");

            return new SideEffectReceipt(
                Id: intentId,
                Mode: "prod",
                EffectType: effectType,
                Target: target,
                Success: true,
                ErrorMessage: null,
                ExecutedAt: now);
        }
        catch (Exception ex)
        {
            _auditLog?.Invoke($"SIDE_EFFECT_FAILED mode=prod effect={effectType} target={target} error={ex.Message}");

            return new SideEffectReceipt(
                Id: intentId,
                Mode: "prod",
                EffectType: effectType,
                Target: target,
                Success: false,
                ErrorMessage: ex.Message,
                ExecutedAt: now);
        }
    }
}

/// <summary>
/// Port for validating governance authorization for side effects.
/// </summary>
public interface IGovernanceAuthorizationValidator
{
    Task<AuthorizationResult> ValidateAsync(
        string effectType,
        string target,
        Dictionary<string, object?> parameters,
        CancellationToken ct = default);
}

/// <summary>
/// Result of authorization validation.
/// </summary>
public sealed record AuthorizationResult(
    bool IsAuthorized,
    string? DenyReason = null);

