using global::Keon.Verification;

namespace MarketOps.Keon;

public sealed class EvidencePackVerifier : IEvidencePackVerifier
{
    public VerifyPackReport Verify(
        string zipPath,
        string? publicKeyPath = null,
        string? trustBundlePath = null,
        DateTimeOffset? nowUtc = null,
        bool allowExpiredTrustBundle = false,
        bool allowExpiredTenantKey = false)
    {
        return MarketOpsAuditWriter.VerifyEvidencePack(
            zipPath,
            publicKeyPath,
            trustBundlePath,
            nowUtc,
            allowExpiredTrustBundle,
            allowExpiredTenantKey);
    }
}
