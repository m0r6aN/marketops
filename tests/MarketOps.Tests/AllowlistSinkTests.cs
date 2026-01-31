using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using global::Keon.Contracts.Decision;
using MarketOps.Contracts;
using MarketOps.Gate;
using MarketOps.Keon;
using Xunit;

namespace MarketOps.Tests;

public sealed class AllowlistSinkTests
{
    [Fact]
    public async Task Gate_DeniesUnknownDestination()
    {
        var packet = MakePacket(destinations: new[] { "github:somewhere-else/private" });
        var decisionClient = new FakeDecisionClient();
        var auditWriter = new FakeAuditWriter();
        var verifier = new FakeVerifier();
        var gate = new KeonGate(decisionClient, auditWriter, verifier, MarketOpsGateConfig.Build(null));

        var result = await gate.EvaluateAsync(packet, CancellationToken.None);

        Assert.False(result.Allowed);
        Assert.Equal("DESTINATION_NOT_ALLOWED", result.DenialCode);
        Assert.Equal(FailureStage.Precheck, result.FailureStage);
        Assert.Equal(0, decisionClient.CallCount);
        Assert.Equal(0, auditWriter.CallCount);
    }

    private static PublishPacket MakePacket(IReadOnlyList<string>? destinations = null)
    {
        return new PublishPacket(
            ArtifactId: "artifact-123",
            ArtifactType: "technical",
            CreatedAtUtc: DateTimeOffset.UtcNow,
            TenantId: "keon-public",
            CorrelationId: "t:keon-public|c:01923e6a-46a9-77f2-9cba-9c9f2f8a8f7c",
            ActorId: "operator-marketops",
            SourceRefs: new[] { "github:keon-systems/docs#readme" },
            PayloadRef: new PayloadRef("file", "public/readme.md"),
            Destinations: destinations ?? new[] { "keon.systems/site-docs" });
    }

    private sealed class FakeDecisionClient : IMarketOpsDecisionClient
    {
        public int CallCount { get; private set; }

        public Task<global::Keon.Contracts.Results.KeonResult<DecisionReceipt>> DecideAsync(DecisionRequest request, CancellationToken ct = default)
        {
            CallCount++;
            return Task.FromResult(global::Keon.Contracts.Results.KeonResult<DecisionReceipt>.Fail("NO_CALL", "Should not be called."));
        }
    }

    private sealed class FakeAuditWriter : IMarketOpsAuditWriter
    {
        public int CallCount { get; private set; }

        public Task<MarketOpsAuditWriter.AuditPaths> WriteReceiptAndPackAsync(
            DecisionReceipt receipt,
            string artifactId,
            DateTimeOffset? fromUtc = null,
            DateTimeOffset? toUtc = null,
            CancellationToken ct = default)
        {
            CallCount++;
            return Task.FromResult(new MarketOpsAuditWriter.AuditPaths("receipt.json", "pack", "pack.zip"));
        }
    }

    private sealed class FakeVerifier : IEvidencePackVerifier
    {
        public global::Keon.Verification.VerifyPackReport Verify(
            string zipPath,
            string? publicKeyPath = null,
            string? trustBundlePath = null,
            DateTimeOffset? nowUtc = null,
            bool allowExpiredTrustBundle = false,
            bool allowExpiredTenantKey = false)
        {
            throw new InvalidOperationException("Should not be called.");
        }
    }
}
