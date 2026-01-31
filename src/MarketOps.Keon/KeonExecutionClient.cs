using System;
using System.Threading;
using System.Threading.Tasks;
using global::Keon.Contracts.Execution;
using global::Keon.Sdk;

namespace MarketOps.Keon;

public sealed class KeonExecutionClient : IMarketOpsExecutionClient
{
    private readonly KeonClient _client;

    public KeonExecutionClient(KeonClient client)
    {
        _client = client ?? throw new ArgumentNullException(nameof(client));
    }

    public Task<global::Keon.Contracts.Results.KeonResult<ExecutionResult>> ExecuteAsync(ExecutionRequest request, CancellationToken ct = default)
        => _client.ExecuteAsync(request, ct);
}
