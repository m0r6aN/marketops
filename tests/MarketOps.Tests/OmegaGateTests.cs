using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MarketOps.Contracts;
using MarketOps.Gate;
using MarketOps.OmegaSdk.Adapters;
using MarketOps.OmegaSdk.Ports;
using Xunit;

namespace MarketOps.Tests;

public sealed class OmegaGateTests
{
    [Fact]
    public async Task AuditUnavailable_DeniesWithAuditStage()
    {
        var gate = BuildGate(auditWriter: new FixedAuditWriter(success: false, errorCode: "AUDIT_UNAVAILABLE"));
        var result = await gate.EvaluateAsync(CreatePacket());

        Assert.False(result.Allowed);
        Assert.Equal(FailureStage.Audit, result.FailureStage);
        Assert.Equal("AUDIT_UNAVAILABLE", result.DenialCode);
    }

    [Fact]
    public async Task MissingHash_DeniesWithHashStage()
    {
        var gate = BuildGate();
        var result = await gate.EvaluateAsync(CreatePacket(sha256: null));

        Assert.False(result.Allowed);
        Assert.Equal(FailureStage.Hash, result.FailureStage);
        Assert.Equal("CANONICAL_HASH_MISSING", result.DenialCode);
    }

    [Fact]
    public async Task EvidenceVerificationFailure_DeniesWithVerifyStage()
    {
        var verifier = new FixedEvidenceVerifier(
            new EvidenceVerificationResult(
                Success: false,
                IsValid: false,
                Verdict: null,
                Phase: null,
                ErrorCodes: new[] { "VERIFY_ERROR" },
                ErrorMessage: "verification failed"));
        var gate = BuildGate(verifier: verifier);
        var result = await gate.EvaluateAsync(CreatePacket());

        Assert.False(result.Allowed);
        Assert.Equal(FailureStage.Verify, result.FailureStage);
        Assert.Equal("VERIFY_ERROR", result.DenialCode);
    }

    [Fact]
    public async Task SuccessfulGate_AllowsAndRecordsVerification()
    {
        var gate = BuildGate();
        var result = await gate.EvaluateAsync(CreatePacket());

        Assert.True(result.Allowed);
        Assert.NotNull(result.Governance);
        Assert.True(result.Governance!.VerificationSummary!.IsValid);
        Assert.Empty(result.Governance.VerificationSummary.ErrorCodes);
    }

    private static OmegaGate BuildGate(
        IGovernanceDecisionClient? decision = null,
        IGovernanceAuditWriter? auditWriter = null,
        IGovernanceEvidenceVerifier? verifier = null,
        IGovernanceExecutionClient? executionClient = null)
    {
        return new OmegaGate(
            decision ?? new FixedDecisionClient(),
            auditWriter ?? new FixedAuditWriter(),
            verifier ?? new FixedEvidenceVerifier(),
            MarketOpsGateConfig.Build(null),
            executionClient);
    }

    private static PublishPacket CreatePacket(string? sha256 = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef")
    {
        return new PublishPacket(
            ArtifactId: "artifact",
            ArtifactType: "type",
            CreatedAtUtc: DateTimeOffset.UtcNow,
            TenantId: "federation-public",
            CorrelationId: Guid.NewGuid().ToString("D"),
            ActorId: "operator-marketops",
            SourceRefs: Array.Empty<string>(),
            PayloadRef: new PayloadRef("file", "payload.bin", Sha256: sha256),
            Destinations: new[] { "federation.systems/site-docs" });
    }

    private sealed class FixedDecisionClient : IGovernanceDecisionClient
    {
        private readonly GovernanceDecisionResult _result;

        public FixedDecisionClient()
        {
            _result = new GovernanceDecisionResult(
                Success: true,
                ReceiptId: "receipt",
                Outcome: "approved",
                DecidedAtUtc: DateTimeOffset.UtcNow);
        }

        public Task<GovernanceDecisionResult> DecideAsync(GovernanceDecisionRequest request, CancellationToken ct = default)
            => Task.FromResult(_result);
    }

    private sealed class FixedAuditWriter : IGovernanceAuditWriter
    {
        private readonly AuditWriteResult _result;

        public FixedAuditWriter(bool success = true, string errorCode = "AUDIT_OK", string? evidencePath = "pack.zip")
        {
            _result = new AuditWriteResult(success, "receipt-path", "pack-id", evidencePath, success ? null : errorCode, success ? null : "audit failed");
        }

        public Task<AuditWriteResult> WriteReceiptAndPackAsync(GovernanceReceiptData receipt, string artifactId, DateTimeOffset? fromUtc = null, DateTimeOffset? toUtc = null, CancellationToken ct = default)
            => Task.FromResult(_result);
    }

    private sealed class FixedEvidenceVerifier : IGovernanceEvidenceVerifier
    {
        private readonly EvidenceVerificationResult _result;

        public FixedEvidenceVerifier(EvidenceVerificationResult? result = null)
        {
            _result = result ?? new EvidenceVerificationResult(Success: true, IsValid: true, Verdict: "valid", Phase: 0, ErrorCodes: Array.Empty<string>());
        }

        public Task<EvidenceVerificationResult> VerifyAsync(string packHash, string? tenantId = null, string? actorId = null, string? correlationId = null, CancellationToken ct = default)
            => Task.FromResult(_result);
    }
}
