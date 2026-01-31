using System.Threading;
using System.Threading.Tasks;
using MarketOps.Contracts;

namespace MarketOps.Gate;

public interface IMarketOpsGate
{
    Task<GateResult> EvaluateAsync(PublishPacket packet, CancellationToken ct = default);
}
