using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MarketOps.Contracts;

namespace MarketOps.Observer;

public interface IMarketOpsObserver
{
    Task<IReadOnlyList<PublishPacket>> CollectAsync(CancellationToken ct = default);
}
