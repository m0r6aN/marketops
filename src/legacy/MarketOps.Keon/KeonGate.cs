using System;
using System.Collections.Generic;
using System.IO;
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
using MarketOps.Contracts;
using MarketOps.Gate;

namespace MarketOps.Keon;

public sealed class KeonGate : IMarketOpsGate
{
    private readonly IMarketOpsDecisionClient _client;
    private readonly IMarketOpsAuditWriter _auditWriter;
    private readonly IEvidencePackVerifier _verifier;
    private readonly IMarketOpsExecutionClient? _executionClient;
    private readonly MarketOpsGateConfig _config;
    private readonly Action<string>? _auditLog;

    public KeonGate(
        IMarketOpsDecisionClient client,
        IMarketOpsAuditWriter auditWriter,
        IEvidencePackVerifier verifier,
        MarketOpsGateConfig config,
        IMarketOpsExecutionClient? executionClient = null,
        Action<string>? auditLog = null)
    {
        _client = client ?? throw new ArgumentNullException(nameof(client));
        _auditWriter = auditWriter ?? throw new ArgumentNullException(nameof(auditWriter));
        _verifier = verifier ?? throw new ArgumentNullException(nameof(verifier));
        _executionClient = executionClient;
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _auditLog = auditLog;
        _config.Validate();
    }

    public KeonGate(
        global::Keon.Sdk.KeonClient client,
        MarketOpsAuditWriter auditWriter,
        MarketOpsGateConfig config,
        Action<string>? auditLog = null)
        : this(
            new KeonDecisionClient(client),
            auditWriter,
            new EvidencePackVerifier(),
            config,
            new KeonExecutionClient(client),
            auditLog)
    {
    }

    public async Task<GateResult> EvaluateAsync(PublishPacket packet, CancellationToken ct = default)
    {
        try
        {
            var validation = ValidatePacket(packet);
            if (validation != null)
            {
                return GateResult.Deny(
                    FailureStage.Precheck,
                    validation.Value.Code,
                    validation.Value.Message,
                    packet,
                    packetHashSha256: null,
                    keon: null);
            }

            var packetHashSha256 = ComputePacketHash(packet);

            if (!string.Equals(packet.TenantId, _config.TenantId, StringComparison.Ordinal))
            {
                return GateResult.Deny(
                    FailureStage.Precheck,
                    "TENANT_MISMATCH",
                    "Packet tenantId does not match MarketOps config.",
                    packet,
                    packetHashSha256,
                    null);
            }

            if (!string.Equals(packet.ActorId, _config.ActorId, StringComparison.Ordinal))
            {
                return GateResult.Deny(
                    FailureStage.Precheck,
                    "ACTOR_MISMATCH",
                    "Packet actorId does not match MarketOps config.",
                    packet,
                    packetHashSha256,
                    null);
            }

            var deniedDestinations = packet.Destinations.Where(d => !_config.IsDestinationAllowed(d)).ToList();
            if (deniedDestinations.Count > 0)
            {
                return GateResult.Deny(
                    FailureStage.Precheck,
                    "DESTINATION_NOT_ALLOWED",
                    $"Denied destinations: {string.Join(", ", deniedDestinations)}",
                    packet,
                    packetHashSha256,
                    null);
            }

            var decisionRequest = BuildDecisionRequest(packet);
            var decisionResult = await _client.DecideAsync(decisionRequest, ct).ConfigureAwait(false);

            if (!decisionResult.Success || decisionResult.Value is null)
            {
                return GateResult.Deny(
                    FailureStage.KeonDecision,
                    "DECISION_FAILED",
                    decisionResult.ErrorMessage ?? "Decision failed.",
                    packet,
                    packetHashSha256,
                    null);
            }

            var receipt = decisionResult.Value;

            if (receipt.Outcome != DecisionOutcome.Approved)
            {
                return GateResult.Deny(
                    FailureStage.KeonDecision,
                    "DECISION_NOT_APPROVED",
                    $"Decision outcome was {receipt.Outcome}.",
                    packet,
                    packetHashSha256,
                    null);
            }

            if (_executionClient != null)
            {
                var executionRequest = BuildExecutionRequest(packet, receipt, packetHashSha256);
                if (executionRequest.Parameters is null || !HasMatchingPacketHash(executionRequest.Parameters, packetHashSha256))
                {
                    return GateResult.Deny(
                        FailureStage.Execution,
                        "EXECUTION_PARAMS_INVALID",
                        "Execution params missing or invalid packetHashSha256.",
                        packet,
                        packetHashSha256,
                        null);
                }

                var executionResult = await _executionClient.ExecuteAsync(executionRequest, ct).ConfigureAwait(false);
                if (!executionResult.Success)
                {
                    return GateResult.Deny(
                        FailureStage.Execution,
                        "EXECUTION_FAILED",
                        executionResult.ErrorMessage ?? "Execution failed.",
                        packet,
                        packetHashSha256,
                        null);
                }
            }

            MarketOpsAuditWriter.AuditPaths auditPaths;
            try
            {
                auditPaths = await _auditWriter.WriteReceiptAndPackAsync(receipt, packet.ArtifactId, ct: ct)
                    .ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                _auditLog?.Invoke($"MARKETOPS_GATE_EVIDENCE_PACK {ex.GetType().Name}");
                return GateResult.Deny(
                    FailureStage.EvidencePack,
                    "EVIDENCE_PACK_FAILED",
                    "Evidence pack generation failed.",
                    packet,
                    packetHashSha256,
                    null);
            }

            VerifyReportSummary? verifySummary;
            try
            {
                var verifyReport = _verifier.Verify(
                    auditPaths.PackZipPath,
                    publicKeyPath: _config.PublicKeyPath,
                    trustBundlePath: _config.TrustBundlePath);

                verifySummary = new VerifyReportSummary(
                    verifyReport.IsValid,
                    verifyReport.Phase,
                    verifyReport.Errors.Select(error => error.Code).ToArray());
            }
            catch (Exception ex)
            {
                _auditLog?.Invoke($"MARKETOPS_GATE_VERIFY {ex.GetType().Name}");
                verifySummary = new VerifyReportSummary(false, 0, new[] { "VERIFY_EXCEPTION" });
            }

            var keonEvidence = new GateKeonEvidence(
                receipt.ReceiptId.Value,
                receipt.Outcome.ToString(),
                receipt.DecidedAtUtc,
                auditPaths.ReceiptPath,
                auditPaths.PackZipPath,
                verifySummary);

            if (keonEvidence.VerifyReportSummary is { IsValid: false })
            {
                return GateResult.Deny(
                    FailureStage.Verify,
                    "VERIFY_FAILED",
                    "Evidence pack verification failed.",
                    packet with { Keon = ToPacketKeon(keonEvidence) },
                    packetHashSha256,
                    keonEvidence);
            }

            return new GateResult(
                Allowed: true,
                DenialCode: null,
                DenialMessage: null,
                FailureStage: null,
                PacketHashSha256: packetHashSha256,
                Packet: packet with { Keon = ToPacketKeon(keonEvidence) },
                Keon: keonEvidence);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _auditLog?.Invoke($"MARKETOPS_GATE_EXCEPTION {ex.GetType().Name}");
            return GateResult.Deny(
                FailureStage.Exception,
                "GATE_EXCEPTION",
                "Gate exception occurred.",
                packet,
                packetHashSha256: null,
                keon: null);
        }
    }

    private static (string Code, string Message)? ValidatePacket(PublishPacket packet)
    {
        if (packet is null)
            return ("PACKET_NULL", "Packet cannot be null.");
        if (string.IsNullOrWhiteSpace(packet.ArtifactId))
            return ("ARTIFACT_ID_MISSING", "ArtifactId cannot be empty.");
        if (string.IsNullOrWhiteSpace(packet.TenantId))
            return ("TENANT_ID_MISSING", "TenantId cannot be empty.");
        if (string.IsNullOrWhiteSpace(packet.CorrelationId))
            return ("CORRELATION_ID_MISSING", "CorrelationId cannot be empty.");
        if (packet.Destinations == null || packet.Destinations.Count == 0)
            return ("DESTINATIONS_EMPTY", "Destinations cannot be empty.");

        foreach (var destination in packet.Destinations)
        {
            if (string.IsNullOrWhiteSpace(destination))
                return ("DESTINATION_INVALID", "Destination cannot be empty.");
            if (!string.Equals(destination, destination.Trim(), StringComparison.Ordinal))
                return ("DESTINATION_INVALID", "Destination cannot contain leading/trailing whitespace.");
            if (destination.Any(char.IsControl))
                return ("DESTINATION_INVALID", "Destination cannot contain control characters.");
        }

        if (packet.PayloadRef is null)
            return ("PAYLOAD_REF_MISSING", "PayloadRef is required.");

        if (!IsAllowedPayloadKind(packet.PayloadRef.Kind))
            return ("PAYLOAD_REF_INVALID", "PayloadRef kind is not allowed.");

        if (!IsSafeRelativePath(packet.PayloadRef.Path))
            return ("PAYLOAD_REF_INVALID", "PayloadRef path must be relative and safe.");

        return null;
    }

    private DecisionRequest BuildDecisionRequest(PublishPacket packet)
    {
        var tenantId = new TenantId(_config.TenantId);
        var actorId = new ActorId(_config.ActorId);
        var correlationId = CorrelationId.From(packet.CorrelationId);
        var sourceRefs = packet.SourceRefs ?? Array.Empty<string>();

        var input = new Dictionary<string, object?>
        {
            ["artifactId"] = packet.ArtifactId,
            ["artifactType"] = packet.ArtifactType,
            ["destinations"] = packet.Destinations.ToArray(),
            ["sourceRefs"] = sourceRefs.ToArray(),
            ["payloadRef"] = new Dictionary<string, object?>
            {
                ["kind"] = packet.PayloadRef.Kind,
                ["path"] = packet.PayloadRef.Path,
                ["contentType"] = packet.PayloadRef.ContentType,
                ["sha256"] = packet.PayloadRef.Sha256
            }
        };

        var context = new DecisionContext(
            tenantId,
            correlationId,
            SessionId: null,
            ClientApp: "marketops",
            Environment: null,
            Tags: new List<string> { "pipeline=marketops", "stage=gate" },
            Operation: "publish");

        return new DecisionRequest(
            RequestId: KeonIds.NewRequest(),
            TenantId: tenantId,
            ActorId: actorId,
            Capability: _config.Capability,
            Input: input,
            Context: context,
            RequestedAtUtc: DateTimeOffset.UtcNow);
    }

    private static PublishPacketKeon ToPacketKeon(GateKeonEvidence evidence)
    {
        return new PublishPacketKeon(
            evidence.ReceiptId,
            evidence.DecisionOutcome,
            evidence.DecidedAtUtc,
            evidence.ReceiptCanonicalPath,
            evidence.EvidencePackZipPath,
            evidence.VerifyReportSummary);
    }

    private static bool IsAllowedPayloadKind(string kind)
    {
        return kind is "file" or "repoPath" or "artifactStore";
    }

    private static bool IsSafeRelativePath(string path)
    {
        if (string.IsNullOrWhiteSpace(path))
            return false;
        if (Uri.TryCreate(path, UriKind.Absolute, out _))
            return false;
        if (path.StartsWith("/", StringComparison.Ordinal) || path.StartsWith("\\", StringComparison.Ordinal))
            return false;
        if (Path.IsPathRooted(path))
            return false;

        var segments = path.Split(new[] { '/', '\\' }, StringSplitOptions.RemoveEmptyEntries);
        if (segments.Any(segment => segment == ".." || segment.Contains(':', StringComparison.Ordinal)))
            return false;

        return true;
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

    private ExecutionRequest BuildExecutionRequest(
        PublishPacket packet,
        DecisionReceipt receipt,
        string packetHashSha256)
    {
        return new ExecutionRequest
        {
            TenantId = new TenantId(_config.TenantId),
            CorrelationId = CorrelationId.From(packet.CorrelationId),
            DecisionReceiptId = new global::Keon.Contracts.Receipts.DecisionReceiptId(receipt.ReceiptId.Value),
            Target = new ExecutionTarget(_config.ExecutionTargetKind, _config.ExecutionTargetName, _config.ExecutionTargetVersion),
            Parameters = new Dictionary<string, object?>
            {
                ["packetHashSha256"] = packetHashSha256,
                ["artifactId"] = packet.ArtifactId,
                ["destinations"] = packet.Destinations.ToArray(),
                ["payloadRef.kind"] = packet.PayloadRef.Kind,
                ["payloadRef.path"] = packet.PayloadRef.Path,
                ["correlationId"] = packet.CorrelationId
            }
        };
    }

    private static bool HasMatchingPacketHash(IReadOnlyDictionary<string, object?> parameters, string packetHashSha256)
    {
        if (!parameters.TryGetValue("packetHashSha256", out var value))
            return false;
        if (value is not string hashValue)
            return false;
        if (string.IsNullOrWhiteSpace(hashValue))
            return false;

        return string.Equals(hashValue, packetHashSha256, StringComparison.Ordinal);
    }
}
