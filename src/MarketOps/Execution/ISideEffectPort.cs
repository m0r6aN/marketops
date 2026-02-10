using System.Threading;
using System.Threading.Tasks;

namespace MarketOps.Execution;

public interface ISideEffectPort
{
    Task<SideEffectAction?> PublishReleaseAsync(
        MarketOpsRun run,
        SideEffectRequest request,
        SideEffectAuthorization? authorization,
        CancellationToken ct = default);

    Task<SideEffectAction?> PublishPostAsync(
        MarketOpsRun run,
        SideEffectRequest request,
        SideEffectAuthorization? authorization,
        CancellationToken ct = default);

    Task<SideEffectAction?> TagRepoAsync(
        MarketOpsRun run,
        SideEffectRequest request,
        SideEffectAuthorization? authorization,
        CancellationToken ct = default);

    Task<SideEffectAction?> OpenPrAsync(
        MarketOpsRun run,
        SideEffectRequest request,
        SideEffectAuthorization? authorization,
        CancellationToken ct = default);
}
