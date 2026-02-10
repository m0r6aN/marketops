using System;
using System.Collections.Generic;

namespace MarketOps.Execution;

public enum SideEffectKind
{
    PublishRelease,
    PublishPost,
    TagRepo,
    OpenPr
}

public sealed record SideEffectTarget(string System, string Ref);

public sealed record RequiredAuthorization(
    string ReceiptType,
    bool EnforceableRequired = true);

public sealed record SideEffectIntentDigest(string JcsSha256);

public sealed record SideEffectIntent(
    string SchemaVersion,
    string IntentId,
    string RunId,
    ExecutionMode Mode,
    SideEffectKind Kind,
    SideEffectTarget Target,
    IReadOnlyDictionary<string, string?> Params,
    DateTimeOffset CreatedAtUtc,
    bool BlockedByMode,
    RequiredAuthorization RequiredAuthorization,
    SideEffectIntentDigest? IntentDigest = null,
    string? BlockedReason = null)
{
    public void ValidateFailClosed()
    {
        if (!Enum.IsDefined(Mode))
            throw new InvalidOperationException("SideEffectIntent.mode is required.");

        if (Mode == ExecutionMode.DryRun && !BlockedByMode)
            throw new InvalidOperationException("Dry run intent must set blocked_by_mode=true.");

        if (Mode == ExecutionMode.Prod && !RequiredAuthorization.EnforceableRequired)
            throw new InvalidOperationException("Prod intent must require enforceable authorization.");
    }
}

public sealed record SideEffectAction(
    string ActionId,
    string RunId,
    SideEffectKind Kind,
    SideEffectTarget Target,
    DateTimeOffset ExecutedAtUtc,
    string? ExternalRef = null);

public sealed record SideEffectAuthorization(
    string ReceiptId,
    bool Enforceable,
    string ReceiptType);

public sealed record SideEffectRequest(
    SideEffectTarget Target,
    IReadOnlyDictionary<string, string?> Params,
    RequiredAuthorization RequiredAuthorization)
{
    public static SideEffectRequest Create(
        string system,
        string @ref,
        IReadOnlyDictionary<string, string?> @params,
        string receiptType)
    {
        return new SideEffectRequest(
            new SideEffectTarget(system, @ref),
            @params,
            new RequiredAuthorization(receiptType, EnforceableRequired: true));
    }
}
