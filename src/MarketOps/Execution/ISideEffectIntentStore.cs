using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace MarketOps.Execution;

public interface ISideEffectIntentStore
{
    Task AppendAsync(SideEffectIntent intent, CancellationToken ct = default);

    Task<IReadOnlyList<SideEffectIntent>> GetByRunIdAsync(string runId, CancellationToken ct = default);
}
