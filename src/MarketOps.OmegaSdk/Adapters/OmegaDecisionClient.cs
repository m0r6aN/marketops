using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MarketOps.OmegaSdk.Ports;
using Omega.Sdk;

namespace MarketOps.OmegaSdk.Adapters;

/// <summary>
/// Adapter for governance decisions using omega-sdk-csharp.
/// Invokes the governance decision tool via Tools.InvokeAsync.
/// </summary>
public sealed class OmegaDecisionClient : IGovernanceDecisionClient
{
    private readonly OmegaClient _client;
    private const string DecisionToolId = "governance.decide";

    public OmegaDecisionClient(OmegaClient client)
    {
        _client = client ?? throw new ArgumentNullException(nameof(client));
    }

    public async Task<GovernanceDecisionResult> DecideAsync(
        GovernanceDecisionRequest request,
        CancellationToken ct = default)
    {
        try
        {
            var input = new Dictionary<string, object>
            {
                ["capability"] = request.Capability,
                ["input"] = request.Input,
                ["context"] = request.Context ?? new Dictionary<string, object?>()
            };

            var result = await _client.Tools.InvokeAsync(
                toolId: DecisionToolId,
                input: input,
                tenantId: request.TenantId,
                actorId: request.ActorId,
                correlationId: request.CorrelationId,
                cancellationToken: ct);

            // Extract receipt from result
            var receiptId = result.Audit?.ReceiptId;

            return new GovernanceDecisionResult(
                Success: true,
                ReceiptId: receiptId,
                Outcome: null,
                DecidedAtUtc: null);
        }
        catch (Exception ex)
        {
            return new GovernanceDecisionResult(
                Success: false,
                ReceiptId: null,
                Outcome: null,
                DecidedAtUtc: null,
                ErrorCode: "DECISION_FAILED",
                ErrorMessage: ex.Message);
        }
    }
}
