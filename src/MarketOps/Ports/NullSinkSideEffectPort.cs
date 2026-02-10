using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace MarketOps.Ports;

/// <summary>
/// Dry-run implementation of ISideEffectPort.
/// Records all intents but NEVER executes external side effects.
/// All operations return "blocked_by_mode" status.
/// </summary>
public sealed class NullSinkSideEffectPort : ISideEffectPort
{
    private readonly List<SideEffectIntent> _recordedIntents = new();
    private readonly Action<string>? _auditLog;

    public NullSinkSideEffectPort(Action<string>? auditLog = null)
    {
        _auditLog = auditLog;
    }

    /// <summary>
    /// Returns all recorded intents (for audit/ledger).
    /// </summary>
    public IReadOnlyList<SideEffectIntent> RecordedIntents => _recordedIntents.AsReadOnly();

    public Task<SideEffectReceipt> PublishReleaseAsync(
        string target,
        Dictionary<string, object?> parameters,
        CancellationToken ct = default)
    {
        return RecordAndBlockAsync(SideEffectType.PublishRelease, target, parameters, ct);
    }

    public Task<SideEffectReceipt> PublishPostAsync(
        string target,
        Dictionary<string, object?> parameters,
        CancellationToken ct = default)
    {
        return RecordAndBlockAsync(SideEffectType.PublishPost, target, parameters, ct);
    }

    public Task<SideEffectReceipt> TagRepoAsync(
        string target,
        Dictionary<string, object?> parameters,
        CancellationToken ct = default)
    {
        return RecordAndBlockAsync(SideEffectType.TagRepo, target, parameters, ct);
    }

    public Task<SideEffectReceipt> OpenPrAsync(
        string target,
        Dictionary<string, object?> parameters,
        CancellationToken ct = default)
    {
        return RecordAndBlockAsync(SideEffectType.OpenPr, target, parameters, ct);
    }

    private Task<SideEffectReceipt> RecordAndBlockAsync(
        SideEffectType effectType,
        string target,
        Dictionary<string, object?> parameters,
        CancellationToken ct)
    {
        var intentId = Guid.NewGuid().ToString();
        var now = DateTimeOffset.UtcNow;

        var intent = new SideEffectIntent(
            Id: intentId,
            Mode: "dry_run",
            EffectType: effectType,
            Target: target,
            Parameters: parameters,
            BlockedByMode: true,
            RequiredAuthorization: new Dictionary<string, object?> { { "enforceable_required", false } },
            Timestamp: now);

        _recordedIntents.Add(intent);
        _auditLog?.Invoke($"SIDE_EFFECT_BLOCKED mode=dry_run effect={effectType} target={target}");

        // Return blocked receipt
        var receipt = new SideEffectReceipt(
            Id: intentId,
            Mode: "dry_run",
            EffectType: effectType,
            Target: target,
            Success: false,
            ErrorMessage: "blocked_by_mode",
            ExecutedAt: now);

        return Task.FromResult(receipt);
    }
}

