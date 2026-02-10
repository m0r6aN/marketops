using System;
using System.Threading;
using System.Threading.Tasks;

namespace MarketOps.Execution;

public sealed class LiveSideEffectPort : ISideEffectPort
{
    private readonly ILiveSideEffectExecutor _executor;

    public LiveSideEffectPort(ILiveSideEffectExecutor executor)
    {
        _executor = executor ?? throw new ArgumentNullException(nameof(executor));
    }

    public Task<SideEffectAction?> PublishReleaseAsync(MarketOpsRun run, SideEffectRequest request, SideEffectAuthorization? authorization, CancellationToken ct = default)
        => ExecuteAsync(SideEffectKind.PublishRelease, run, request, authorization, ct);

    public Task<SideEffectAction?> PublishPostAsync(MarketOpsRun run, SideEffectRequest request, SideEffectAuthorization? authorization, CancellationToken ct = default)
        => ExecuteAsync(SideEffectKind.PublishPost, run, request, authorization, ct);

    public Task<SideEffectAction?> TagRepoAsync(MarketOpsRun run, SideEffectRequest request, SideEffectAuthorization? authorization, CancellationToken ct = default)
        => ExecuteAsync(SideEffectKind.TagRepo, run, request, authorization, ct);

    public Task<SideEffectAction?> OpenPrAsync(MarketOpsRun run, SideEffectRequest request, SideEffectAuthorization? authorization, CancellationToken ct = default)
        => ExecuteAsync(SideEffectKind.OpenPr, run, request, authorization, ct);

    private Task<SideEffectAction?> ExecuteAsync(
        SideEffectKind kind,
        MarketOpsRun run,
        SideEffectRequest request,
        SideEffectAuthorization? authorization,
        CancellationToken ct)
    {
        run.EnsureModeIsPresent();
        if (run.Mode != ExecutionMode.Prod)
            throw new InvalidOperationException("LiveSideEffectPort cannot execute while mode is dry_run.");

        if (authorization is null)
            throw new InvalidOperationException("Prod mode side effect requires explicit authorization.");

        if (!authorization.Enforceable)
            throw new InvalidOperationException("Prod mode side effect authorization must be enforceable=true.");

        if (!request.RequiredAuthorization.EnforceableRequired)
            throw new InvalidOperationException("Prod mode side effect must require enforceable authorization.");

        using var _ = SideEffectBoundaryGuard.EnterPortScope();
        SideEffectBoundaryGuard.AssertInsidePort(kind.ToString());
        return _executor.ExecuteAsync(run, kind, request, authorization, ct);
    }
}

public interface ILiveSideEffectExecutor
{
    Task<SideEffectAction?> ExecuteAsync(
        MarketOpsRun run,
        SideEffectKind kind,
        SideEffectRequest request,
        SideEffectAuthorization authorization,
        CancellationToken ct = default);
}
