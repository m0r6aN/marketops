using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace MarketOps.Execution;

public sealed class NullSinkSideEffectPort : ISideEffectPort
{
    private readonly ISideEffectIntentStore _intentStore;
    private readonly Func<string> _intentIdFactory;

    public NullSinkSideEffectPort(ISideEffectIntentStore intentStore, Func<string>? intentIdFactory = null)
    {
        _intentStore = intentStore ?? throw new ArgumentNullException(nameof(intentStore));
        _intentIdFactory = intentIdFactory ?? (() => $"intent_{Guid.NewGuid():N}");
    }

    public Task<SideEffectAction?> PublishReleaseAsync(MarketOpsRun run, SideEffectRequest request, SideEffectAuthorization? authorization, CancellationToken ct = default)
        => RecordIntentAsync(SideEffectKind.PublishRelease, run, request, ct);

    public Task<SideEffectAction?> PublishPostAsync(MarketOpsRun run, SideEffectRequest request, SideEffectAuthorization? authorization, CancellationToken ct = default)
        => RecordIntentAsync(SideEffectKind.PublishPost, run, request, ct);

    public Task<SideEffectAction?> TagRepoAsync(MarketOpsRun run, SideEffectRequest request, SideEffectAuthorization? authorization, CancellationToken ct = default)
        => RecordIntentAsync(SideEffectKind.TagRepo, run, request, ct);

    public Task<SideEffectAction?> OpenPrAsync(MarketOpsRun run, SideEffectRequest request, SideEffectAuthorization? authorization, CancellationToken ct = default)
        => RecordIntentAsync(SideEffectKind.OpenPr, run, request, ct);

    private async Task<SideEffectAction?> RecordIntentAsync(SideEffectKind kind, MarketOpsRun run, SideEffectRequest request, CancellationToken ct)
    {
        run.EnsureModeIsPresent();
        if (run.Mode != ExecutionMode.DryRun)
            throw new InvalidOperationException("NullSinkSideEffectPort may only be used in dry_run mode.");

        var intent = new SideEffectIntent(
            SchemaVersion: "marketops.side_effect_intent.v1",
            IntentId: _intentIdFactory(),
            RunId: run.RunId,
            Mode: run.Mode,
            Kind: kind,
            Target: request.Target,
            Params: request.Params,
            CreatedAtUtc: DateTimeOffset.UtcNow,
            BlockedByMode: true,
            RequiredAuthorization: request.RequiredAuthorization,
            IntentDigest: null,
            BlockedReason: "blocked_by_mode");

        intent.ValidateFailClosed();
        await _intentStore.AppendAsync(intent, ct);
        return null;
    }
}
