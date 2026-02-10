using System;
using System.Threading;
using System.Threading.Tasks;
using global::Keon.Contracts.Decision;

namespace MarketOps.Keon;

public interface IMarketOpsAuditWriter
{
    Task<MarketOpsAuditWriter.AuditPaths> WriteReceiptAndPackAsync(
        DecisionReceipt receipt,
        string artifactId,
        DateTimeOffset? fromUtc = null,
        DateTimeOffset? toUtc = null,
        CancellationToken ct = default);
}
