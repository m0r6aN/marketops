using System;
using System.Threading;
using System.Threading.Tasks;
using MarketOps.OmegaSdk.Ports;
using Omega.Sdk;

namespace MarketOps.OmegaSdk.Adapters;

/// <summary>
/// Adapter for governance audit writing using omega-sdk-csharp.
/// 
/// ⚠️ CRITICAL SDK GAPS:
/// - No Evidence.DownloadAsync() for ZIP download
/// - No Evidence.CreateAsync() for pack creation
/// - No public canonicalization utility
/// 
/// This adapter FAILS CLOSED until SDK provides these capabilities.
/// </summary>
public sealed class OmegaAuditWriter : IGovernanceAuditWriter
{
    private readonly OmegaClient _client;

    public OmegaAuditWriter(OmegaClient client)
    {
        _client = client ?? throw new ArgumentNullException(nameof(client));
    }

    public Task<AuditWriteResult> WriteReceiptAndPackAsync(
        GovernanceReceiptData receipt,
        string artifactId,
        DateTimeOffset? fromUtc = null,
        DateTimeOffset? toUtc = null,
        CancellationToken ct = default)
    {
        // FAIL CLOSED: SDK does not expose required capabilities
        // Required but missing:
        // 1. Evidence.CreateAsync() or tool invocation for evidence pack creation
        // 2. Evidence.DownloadAsync() for ZIP file download
        // 3. Public canonicalization utility for receipt serialization
        
        return Task.FromResult(new AuditWriteResult(
            Success: false,
            ReceiptPath: null,
            EvidencePackId: null,
            EvidencePackZipPath: null,
            ErrorCode: "SDK_GAP_AUDIT_WRITE",
            ErrorMessage: "omega-sdk-csharp does not expose Evidence.CreateAsync() or Evidence.DownloadAsync(). " +
                         "Cannot write audit trail without these capabilities. " +
                         "See docs/.internal/session-output/SDK_GAPS.md for details."));
    }
}

