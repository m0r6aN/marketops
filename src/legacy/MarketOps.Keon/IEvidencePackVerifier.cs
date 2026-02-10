using System;
using global::Keon.Verification;

namespace MarketOps.Keon;

public interface IEvidencePackVerifier
{
    VerifyPackReport Verify(
        string zipPath,
        string? publicKeyPath = null,
        string? trustBundlePath = null,
        DateTimeOffset? nowUtc = null,
        bool allowExpiredTrustBundle = false,
        bool allowExpiredTenantKey = false);
}
