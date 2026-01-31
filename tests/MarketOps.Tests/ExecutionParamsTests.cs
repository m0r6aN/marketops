using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using global::Keon.Canonicalization;
using global::Keon.Contracts;
using global::Keon.Contracts.Decision;
using global::Keon.Contracts.Execution;
using global::Keon.Contracts.Identifiers;
using global::Keon.Sdk.Testing.TestFixtures;
using MarketOps.Contracts;
using MarketOps.Gate;
using MarketOps.Keon;
using Xunit;

namespace MarketOps.Tests;

public sealed class ExecutionParamsTests
{
    [Fact]
    public async Task EvaluateAsync_ApprovedExecution_InjectsPacketHashParams()
    {
        var packet = MakePacket();
        var decisionClient = new FakeDecisionClient(CreateApprovedReceipt(packet));
        var auditWriter = new FakeAuditWriter();
        var verifier = new FakeVerifier(isValid: true);
        var executionClient = new FakeExecutionClient(
            global::Keon.Contracts.Results.KeonResult<ExecutionResult>.Ok(
                ExecutionResults.CreateCompleted(CorrelationId.From(packet.CorrelationId))));
        var gate = new KeonGate(decisionClient, auditWriter, verifier, MarketOpsGateConfig.Build(null), executionClient);

        var result = await gate.EvaluateAsync(packet, CancellationToken.None);

        Assert.True(result.Allowed);
        Assert.NotNull(executionClient.LastRequest);
        Assert.Equal(1, executionClient.CallCount);

        var expectedHash = ComputePacketHash(packet);
        var request = executionClient.LastRequest!;
        Assert.NotNull(request.Parameters);
        var parameters = request.Parameters!;
        Assert.True(parameters.TryGetValue("packetHashSha256", out var hashValue));
        Assert.Equal(expectedHash, hashValue as string);
        Assert.Equal(packet.ArtifactId, parameters["artifactId"] as string);
        Assert.Equal(packet.CorrelationId, parameters["correlationId"] as string);
        Assert.Equal(packet.PayloadRef.Kind, parameters["payloadRef.kind"] as string);
        Assert.Equal(packet.PayloadRef.Path, parameters["payloadRef.path"] as string);

        var destinations = parameters["destinations"] as string[];
        Assert.NotNull(destinations);
        Assert.Equal(packet.Destinations.ToArray(), destinations!);
    }

    [Fact]
    public async Task EvaluateAsync_ApprovedExecutionFailure_DeniesExecutionFailed()
    {
        var packet = MakePacket();
        var decisionClient = new FakeDecisionClient(CreateApprovedReceipt(packet));
        var auditWriter = new FakeAuditWriter();
        var verifier = new ThrowingVerifier();
        var executionClient = new FakeExecutionClient(
            global::Keon.Contracts.Results.KeonResult<ExecutionResult>.Fail("EXECUTION_FAILED", "fail"));
        var gate = new KeonGate(decisionClient, auditWriter, verifier, MarketOpsGateConfig.Build(null), executionClient);

        var result = await gate.EvaluateAsync(packet, CancellationToken.None);

        Assert.False(result.Allowed);
        Assert.Equal("EXECUTION_FAILED", result.DenialCode);
        Assert.Equal(FailureStage.Execution, result.FailureStage);
        Assert.Equal(1, executionClient.CallCount);
        Assert.Equal(0, auditWriter.CallCount);
    }

    [Fact]
    public async Task EvaluateAsync_PrecheckDenied_SkipsExecution()
    {
        var packet = MakePacket(tenantId: "not-keon-public");
        var decisionClient = new ThrowingDecisionClient();
        var auditWriter = new FakeAuditWriter();
        var verifier = new ThrowingVerifier();
        var executionClient = new FakeExecutionClient(
            global::Keon.Contracts.Results.KeonResult<ExecutionResult>.Fail("NO_CALL", "Should not be called."));
        var gate = new KeonGate(decisionClient, auditWriter, verifier, MarketOpsGateConfig.Build(null), executionClient);

        var result = await gate.EvaluateAsync(packet, CancellationToken.None);

        Assert.False(result.Allowed);
        Assert.Equal(FailureStage.Precheck, result.FailureStage);
        Assert.Equal(0, executionClient.CallCount);
        Assert.Equal(0, decisionClient.CallCount);
    }

    private static PublishPacket MakePacket(string? tenantId = null)
    {
        return new PublishPacket(
            ArtifactId: "artifact-123",
            ArtifactType: "technical",
            CreatedAtUtc: DateTimeOffset.UtcNow,
            TenantId: tenantId ?? "keon-public",
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

    private static string ComputePacketHash(PublishPacket packet)
    {
        var canonical = KeonCanonicalJsonV1.Canonicalize(packet with { Keon = null });
        using var sha = SHA256.Create();
        var hash = sha.ComputeHash(canonical);
        var builder = new StringBuilder(hash.Length * 2);
        foreach (var b in hash)
        {
            builder.Append(b.ToString("x2"));
        }

        return builder.ToString();
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

    private sealed class ThrowingDecisionClient : IMarketOpsDecisionClient
    {
        public int CallCount { get; private set; }

        public Task<global::Keon.Contracts.Results.KeonResult<DecisionReceipt>> DecideAsync(DecisionRequest request, CancellationToken ct = default)
        {
            CallCount++;
            return Task.FromResult(global::Keon.Contracts.Results.KeonResult<DecisionReceipt>.Fail("NO_CALL", "Should not be called."));
        }
    }

    private sealed class FakeExecutionClient : IMarketOpsExecutionClient
    {
        private readonly global::Keon.Contracts.Results.KeonResult<ExecutionResult> _result;
        public int CallCount { get; private set; }
        public ExecutionRequest? LastRequest { get; private set; }

        public FakeExecutionClient(global::Keon.Contracts.Results.KeonResult<ExecutionResult> result)
        {
            _result = result;
        }

        public Task<global::Keon.Contracts.Results.KeonResult<ExecutionResult>> ExecuteAsync(ExecutionRequest request, CancellationToken ct = default)
        {
            CallCount++;
            LastRequest = request;
            return Task.FromResult(_result);
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

    private sealed class ThrowingVerifier : IEvidencePackVerifier
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
