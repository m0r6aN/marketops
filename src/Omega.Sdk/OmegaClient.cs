using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace Omega.Sdk;

public sealed class OmegaOptions
{
    public string? FederationUrl { get; set; }
}

public sealed class OmegaClient
{
    public OmegaClient(OmegaOptions? options = null)
    {
        Options = options ?? new OmegaOptions();
        Tools = new ToolsClient();
        Evidence = new EvidenceClient();
    }

    public OmegaOptions Options { get; }

    public ToolsClient Tools { get; }

    public EvidenceClient Evidence { get; }
}

public sealed class ToolsClient
{
    public Task<ToolInvocationResult> InvokeAsync(
        string toolId,
        Dictionary<string, object> input,
        string? tenantId = null,
        string? actorId = null,
        string? correlationId = null,
        string? decisionReceiptId = null,
        CancellationToken cancellationToken = default)
    {
        throw new NotSupportedException("Omega.Sdk stub cannot invoke tools.");
    }
}

public sealed class EvidenceClient
{
    public Task<OmegaEvidenceVerificationResult> VerifyAsync(
        string packHash,
        string? tenantId = null,
        string? actorId = null,
        string? correlationId = null,
        CancellationToken cancellationToken = default)
    {
        throw new NotSupportedException("Omega.Sdk stub cannot verify evidence.");
    }
}

public sealed class ToolInvocationResult
{
    public AuditRecord? Audit { get; init; }

    public object? Result { get; init; }
}

public sealed class AuditRecord
{
    public string? ReceiptId { get; init; }
}

public sealed class OmegaEvidenceVerificationResult
{
    public bool IsValid { get; init; }

    public string? Verdict { get; init; }
}
