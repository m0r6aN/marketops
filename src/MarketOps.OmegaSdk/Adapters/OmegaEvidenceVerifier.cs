using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MarketOps.OmegaSdk.Ports;
using Omega.Sdk;

namespace MarketOps.OmegaSdk.Adapters;

/// <summary>
/// Adapter for governance evidence verification using omega-sdk-csharp.
/// Uses Evidence.VerifyAsync() method.
/// </summary>
public sealed class OmegaEvidenceVerifier : IGovernanceEvidenceVerifier
{
    private readonly OmegaClient _client;

    public OmegaEvidenceVerifier(OmegaClient client)
    {
        _client = client ?? throw new ArgumentNullException(nameof(client));
    }

    public async Task<EvidenceVerificationResult> VerifyAsync(
        string packHash,
        string? tenantId = null,
        string? actorId = null,
        string? correlationId = null,
        CancellationToken ct = default)
    {
        try
        {
            var result = await _client.Evidence.VerifyAsync(
                packHash: packHash,
                tenantId: tenantId,
                actorId: actorId,
                correlationId: correlationId,
                cancellationToken: ct);

            return new EvidenceVerificationResult(
                Success: true,
                IsValid: result.IsValid,
                Verdict: result.Verdict,
                Phase: null,
                ErrorCodes: null);
        }
        catch (Exception ex)
        {
            return new EvidenceVerificationResult(
                Success: false,
                IsValid: false,
                Verdict: null,
                Phase: null,
                ErrorCodes: null,
                ErrorMessage: ex.Message);
        }
    }
}

