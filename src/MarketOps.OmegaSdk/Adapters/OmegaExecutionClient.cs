using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MarketOps.OmegaSdk.Ports;
using Omega.Sdk;

namespace MarketOps.OmegaSdk.Adapters;

/// <summary>
/// Adapter for governance execution using omega-sdk-csharp.
/// Invokes the governance execution tool via Tools.InvokeAsync.
/// </summary>
public sealed class OmegaExecutionClient : IGovernanceExecutionClient
{
    private readonly OmegaClient _client;
    private const string ExecutionToolId = "governance.execute";

    public OmegaExecutionClient(OmegaClient client)
    {
        _client = client ?? throw new ArgumentNullException(nameof(client));
    }

    public async Task<GovernanceExecutionResult> ExecuteAsync(
        GovernanceExecutionRequest request,
        CancellationToken ct = default)
    {
        try
        {
            var input = new Dictionary<string, object>
            {
                ["target"] = request.Target,
                ["parameters"] = request.Parameters
            };

            var result = await _client.Tools.InvokeAsync(
                toolId: ExecutionToolId,
                input: input,
                decisionReceiptId: request.DecisionReceiptId,
                tenantId: request.TenantId,
                actorId: request.ActorId,
                correlationId: request.CorrelationId,
                cancellationToken: ct);

            // Extract execution metadata from result
            var output = result.Result as Dictionary<string, object?>;

            return new GovernanceExecutionResult(
                Success: true,
                ExecutionId: null,
                Status: null,
                ExecutedAtUtc: null,
                Output: output,
                ErrorCode: null,
                ErrorMessage: null);
        }
        catch (Exception ex)
        {
            return new GovernanceExecutionResult(
                Success: false,
                ExecutionId: null,
                Status: null,
                ExecutedAtUtc: null,
                Output: null,
                ErrorCode: "EXECUTION_FAILED",
                ErrorMessage: ex.Message);
        }
    }
}
