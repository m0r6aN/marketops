using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using global::Keon.Contracts;
using global::Keon.Contracts.Decision;
using global::Keon.Contracts.Identifiers;
using MarketOps.Contracts;
using MarketOps.Gate;
using MarketOps.Keon;
using Xunit;

namespace MarketOps.Tests;

public sealed class FailClosedGateTests
{
    [Fact]
    public async Task EvaluateAsync_ApprovedDecisionButVerifyFails_DeniesFailClosed()
    {
        var packet = MakePacket();
        var decisionClient = new FakeDecisionClient(CreateApprovedReceipt(packet));
        var auditWriter = new FakeAuditWriter();
        var verifier = new FakeVerifier(isValid: false);
        var gate = new KeonGate(decisionClient, auditWriter, verifier, MarketOpsGateConfig.Build(null));

        var result = await gate.EvaluateAsync(packet, CancellationToken.None);

        Assert.False(result.Allowed);
        Assert.Equal("VERIFY_FAILED", result.DenialCode);
        Assert.Equal(FailureStage.Verify, result.FailureStage);
        Assert.NotNull(result.Packet.Keon);
        Assert.NotNull(result.Keon);
        Assert.Equal(1, decisionClient.CallCount);
        Assert.Equal(1, auditWriter.CallCount);
    }

    private static PublishPacket MakePacket()
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
            Destinations: new[] { "keon.systems/site-docs" });
    }

    private static DecisionReceipt CreateApprovedReceipt(PublishPacket packet)
    {
        return new DecisionReceipt(
            ReceiptId: new ReceiptId("receipt-001"),
            RequestId: KeonIds.NewRequest(),
            TraceId: KeonIds.NewTrace(),
            ActorId: new ActorId(packet.ActorId),
            Capability: "marketops.publish",
            Context: new DecisionContext(
                new TenantId(packet.TenantId),
                CorrelationId.From(packet.CorrelationId),
                SessionId: null,
                ClientApp: "marketops",
                Environment: null,
                Tags: new List<string>(),
                Operation: "publish"),
            RequestedAtUtc: DateTimeOffset.UtcNow.AddSeconds(-1),
            DecidedAtUtc: DateTimeOffset.UtcNow,
            DurationMs: null,
            ReceiptVersion: "1.0",
            Outcome: DecisionOutcome.Approved,
            Policy: new PolicyEvaluation(
                new PolicyId("policy-1"),
                PolicyEffect.Allow,
                "1.0",
                Array.Empty<string>(),
                null),
            Authority: new AuthorityDecision(
                Granted: true,
                GrantId: null,
                GrantReason: null,
                ExpiresAtUtc: null),
            Evidence: Array.Empty<Evidence>(),
            Notices: Array.Empty<DecisionNotice>());
    }

    private sealed class FakeDecisionClient : IMarketOpsDecisionClient
    {
        private readonly DecisionReceipt _receipt;
        public int CallCount { get; private set; }

        public FakeDecisionClient(DecisionReceipt receipt)
        {
            _receipt = receipt;
        }

        public Task<global::Keon.Contracts.Results.KeonResult<DecisionReceipt>> DecideAsync(DecisionRequest request, CancellationToken ct = default)
        {
            CallCount++;
            return Task.FromResult(global::Keon.Contracts.Results.KeonResult<DecisionReceipt>.Ok(_receipt));
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
        private readonly bool _isValid;

        public FakeVerifier(bool isValid)
        {
            _isValid = isValid;
        }

        public global::Keon.Verification.VerifyPackReport Verify(
            string zipPath,
            string? publicKeyPath = null,
            string? trustBundlePath = null,
            DateTimeOffset? nowUtc = null,
            bool allowExpiredTrustBundle = false,
            bool allowExpiredTenantKey = false)
        {
            return new global::Keon.Verification.VerifyPackReport(
                SchemaId: global::Keon.Verification.VerifyPackReport.DefaultSchemaId,
                Verdict: _isValid ? "PASS" : "FAIL",
                IsValid: _isValid,
                Phase: 4,
                PackHash: string.Empty,
                TenantId: null,
                SignerKids: Array.Empty<string>(),
                PackIntegrity: true,
                SignatureValid: true,
                AuthorizationValid: true,
                TrustBundleProvided: false,
                Warnings: Array.Empty<string>(),
                Errors: Array.Empty<global::Keon.Verify.VerificationError>());
        }
    }
}
