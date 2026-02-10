using System.Threading;
using System.Threading.Tasks;
using global::Keon.Contracts.Execution;

namespace MarketOps.Keon;

public interface IMarketOpsExecutionClient
{
    Task<global::Keon.Contracts.Results.KeonResult<ExecutionResult>> ExecuteAsync(ExecutionRequest request, CancellationToken ct = default);
}
