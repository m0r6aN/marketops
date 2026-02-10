using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace MarketOps.Ports;

/// <summary>
/// Type of external side effect.
/// </summary>
public enum SideEffectType
{
    PublishRelease = 0,
    PublishPost = 1,
    TagRepo = 2,
    OpenPr = 3
}

/// <summary>
/// Records intent to perform a side effect.
/// In dry_run: always blocked, intent recorded.
/// In prod: requires enforceable authorization before execution.
/// </summary>
public sealed record SideEffectIntent(
    string Id,
    string Mode,
    SideEffectType EffectType,
    string Target,
    Dictionary<string, object?> Parameters,
    bool BlockedByMode,
    Dictionary<string, object?> RequiredAuthorization,
    DateTimeOffset Timestamp);

/// <summary>
/// Records successful execution of a side effect (prod mode only).
/// </summary>
public sealed record SideEffectReceipt(
    string Id,
    string Mode,
    SideEffectType EffectType,
    string Target,
    bool Success,
    string? ErrorMessage,
    DateTimeOffset ExecutedAt);

/// <summary>
/// Port for all external side effects.
/// Single boundary: all side effects must route through this interface.
/// Fail-closed: any attempt to bypass → exception.
/// </summary>
public interface ISideEffectPort
{
    Task<SideEffectReceipt> PublishReleaseAsync(
        string target,
        Dictionary<string, object?> parameters,
        CancellationToken ct = default);

    Task<SideEffectReceipt> PublishPostAsync(
        string target,
        Dictionary<string, object?> parameters,
        CancellationToken ct = default);

    Task<SideEffectReceipt> TagRepoAsync(
        string target,
        Dictionary<string, object?> parameters,
        CancellationToken ct = default);

    Task<SideEffectReceipt> OpenPrAsync(
        string target,
        Dictionary<string, object?> parameters,
        CancellationToken ct = default);
}

