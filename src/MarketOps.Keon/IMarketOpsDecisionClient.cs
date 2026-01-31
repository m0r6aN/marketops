using System.Threading;
using System.Threading.Tasks;
using global::Keon.Contracts.Decision;

namespace MarketOps.Keon;

public interface IMarketOpsDecisionClient
{
    Task<global::Keon.Contracts.Results.KeonResult<DecisionReceipt>> DecideAsync(DecisionRequest request, CancellationToken ct = default);
}
