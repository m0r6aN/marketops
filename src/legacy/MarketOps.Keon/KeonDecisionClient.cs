using System;
using System.Threading;
using System.Threading.Tasks;
using global::Keon.Contracts.Decision;
using global::Keon.Sdk;

namespace MarketOps.Keon;

public sealed class KeonDecisionClient : IMarketOpsDecisionClient
{
    private readonly KeonClient _client;

    public KeonDecisionClient(KeonClient client)
    {
        _client = client ?? throw new ArgumentNullException(nameof(client));
    }

    public Task<global::Keon.Contracts.Results.KeonResult<DecisionReceipt>> DecideAsync(DecisionRequest request, CancellationToken ct = default)
        => _client.DecideAsync(request, ct);
}
