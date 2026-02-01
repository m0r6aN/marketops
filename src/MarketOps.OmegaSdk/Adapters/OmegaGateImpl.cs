using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MarketOps.Contracts;
using MarketOps.Gate;
using MarketOps.OmegaSdk.Ports;
using Omega.Sdk;

namespace MarketOps.OmegaSdk.Adapters;

/// <summary>
/// Gate implementation using omega-sdk-csharp adapters.
/// ⚠️ SDK GAPS: No canonicalization, no Evidence.DownloadAsync()
/// </summary>
public sealed class OmegaGate : IMarketOpsGate
{
    private readonly IGovernanceDecisionClient _decisionClient;
    private readonly IGovernanceExecutionClient? _executionClient;
    private readonly IGovernanceAuditWriter _auditWriter;
    private readonly IGovernanceEvidenceVerifier _evidenceVerifier;
    private readonly MarketOpsGateConfig _config;
    private readonly Action<string>? _auditLog;

    public OmegaGate(
        IGovernanceDecisionClient decisionClient,
        IGovernanceAuditWriter auditWriter,
        IGovernanceEvidenceVerifier evidenceVerifier,
        MarketOpsGateConfig config,
        IGovernanceExecutionClient? executionClient = null,
        Action<string>? auditLog = null)
    {
        _decisionClient = decisionClient ?? throw new ArgumentNullException(nameof(decisionClient));
        _auditWriter = auditWriter ?? throw new ArgumentNullException(nameof(auditWriter));
        _evidenceVerifier = evidenceVerifier ?? throw new ArgumentNullException(nameof(evidenceVerifier));
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _executionClient = executionClient;
        _auditLog = auditLog;
        _config.Validate();
    }

    public async Task<GateResult> EvaluateAsync(PublishPacket packet, CancellationToken ct = default)
    {
        try
        {
            var validation = ValidatePacket(packet);
            if (validation != null)
                return GateResult.Deny(FailureStage.Precheck, validation.Value.Code, validation.Value.Message, packet);

            string? packetHashSha256 = null; // SDK GAP: No canonicalization

            if (!string.Equals(packet.TenantId, _config.TenantId, StringComparison.Ordinal))
                return GateResult.Deny(FailureStage.Precheck, "TENANT_MISMATCH", "Tenant mismatch", packet, packetHashSha256);

            if (!string.Equals(packet.ActorId, _config.ActorId, StringComparison.Ordinal))
                return GateResult.Deny(FailureStage.Precheck, "ACTOR_MISMATCH", "Actor mismatch", packet, packetHashSha256);

            var deniedDests = packet.Destinations.Where(d => !_config.IsDestinationAllowed(d)).ToList();
            if (deniedDests.Count > 0)
                return GateResult.Deny(FailureStage.Precheck, "DESTINATION_NOT_ALLOWED", $"Denied: {string.Join(", ", deniedDests)}", packet, packetHashSha256);

            var decisionRequest = BuildDecisionRequest(packet);
            var decisionResult = await _decisionClient.DecideAsync(decisionRequest, ct);

            if (!decisionResult.Success || decisionResult.Outcome != "approved")
                return GateResult.Deny(FailureStage.Decision, "DECISION_NOT_APPROVED", decisionResult.ErrorMessage ?? "Not approved", packet, packetHashSha256);

            if (_executionClient != null && decisionResult.ReceiptId != null)
            {
                var execReq = BuildExecutionRequest(packet, decisionResult.ReceiptId, packetHashSha256);
                var execRes = await _executionClient.ExecuteAsync(execReq, ct);
                if (!execRes.Success)
                    return GateResult.Deny(FailureStage.Exception, "EXECUTION_FAILED", execRes.ErrorMessage ?? "Execution failed", packet, packetHashSha256);
            }

            var auditResult = await _auditWriter.WriteReceiptAndPackAsync(
                new GovernanceReceiptData(decisionResult.ReceiptId ?? "unknown", packet.TenantId, packet.CorrelationId,
                    decisionResult.Outcome ?? "unknown", decisionResult.DecidedAtUtc ?? DateTimeOffset.UtcNow, new { }),
                packet.ArtifactId, ct: ct);

            if (!auditResult.Success)
                _auditLog?.Invoke($"AUDIT_FAILED {auditResult.ErrorCode}");

            var governance = new GovernanceEvidence(
                decisionResult.ReceiptId ?? "unknown",
                decisionResult.Outcome ?? "approved",
                decisionResult.DecidedAtUtc ?? DateTimeOffset.UtcNow,
                auditResult.ReceiptPath ?? "unavailable",
                auditResult.EvidencePackZipPath ?? "unavailable",
                null);

            return GateResult.Allow(packet, packetHashSha256 ?? "unavailable", governance);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _auditLog?.Invoke($"GATE_EXCEPTION {ex.GetType().Name}");
            return GateResult.Deny(FailureStage.Exception, "GATE_EXCEPTION", ex.Message, packet);
        }
    }

    private static (string Code, string Message)? ValidatePacket(PublishPacket packet)
    {
        if (packet is null) return ("PACKET_NULL", "Packet cannot be null");
        if (string.IsNullOrWhiteSpace(packet.ArtifactId)) return ("ARTIFACT_ID_MISSING", "ArtifactId required");
        if (string.IsNullOrWhiteSpace(packet.TenantId)) return ("TENANT_ID_MISSING", "TenantId required");
        if (string.IsNullOrWhiteSpace(packet.CorrelationId)) return ("CORRELATION_ID_MISSING", "CorrelationId required");
        if (packet.Destinations == null || packet.Destinations.Count == 0) return ("DESTINATIONS_EMPTY", "Destinations required");
        if (packet.PayloadRef is null) return ("PAYLOAD_REF_MISSING", "PayloadRef required");
        if (!IsAllowedPayloadKind(packet.PayloadRef.Kind)) return ("PAYLOAD_REF_INVALID", "Invalid payload kind");
        if (!IsSafeRelativePath(packet.PayloadRef.Path)) return ("PAYLOAD_REF_INVALID", "Invalid payload path");
        return null;
    }

    private GovernanceDecisionRequest BuildDecisionRequest(PublishPacket packet)
    {
        var input = new Dictionary<string, object?>
        {
            ["artifactId"] = packet.ArtifactId,
            ["artifactType"] = packet.ArtifactType,
            ["destinations"] = packet.Destinations.ToArray(),
            ["sourceRefs"] = packet.SourceRefs?.ToArray() ?? Array.Empty<string>(),
            ["payloadRef"] = new Dictionary<string, object?>
            {
                ["kind"] = packet.PayloadRef.Kind,
                ["path"] = packet.PayloadRef.Path,
                ["contentType"] = packet.PayloadRef.ContentType,
                ["sha256"] = packet.PayloadRef.Sha256
            }
        };

        var context = new Dictionary<string, object?>
        {
            ["clientApp"] = "marketops",
            ["operation"] = "publish",
            ["tags"] = new[] { "pipeline=marketops", "stage=gate" }
        };

        return new GovernanceDecisionRequest(_config.TenantId, _config.ActorId, packet.CorrelationId, _config.Capability, input, context);
    }

    private GovernanceExecutionRequest BuildExecutionRequest(PublishPacket packet, string receiptId, string? packetHashSha256)
    {
        var parameters = new Dictionary<string, object?>
        {
            ["packetHashSha256"] = packetHashSha256,
            ["artifactId"] = packet.ArtifactId,
            ["destinations"] = packet.Destinations.ToArray(),
            ["payloadRef.kind"] = packet.PayloadRef.Kind,
            ["payloadRef.path"] = packet.PayloadRef.Path,
            ["correlationId"] = packet.CorrelationId
        };

        return new GovernanceExecutionRequest(_config.TenantId, _config.ActorId, packet.CorrelationId, receiptId, "marketops-publish", parameters);
    }

    private static bool IsAllowedPayloadKind(string kind) => kind is "file" or "repoPath" or "artifactStore";

    private static bool IsSafeRelativePath(string path)
    {
        if (string.IsNullOrWhiteSpace(path)) return false;
        if (Uri.TryCreate(path, UriKind.Absolute, out _)) return false;
        if (path.StartsWith("/") || path.StartsWith("\\")) return false;
        if (Path.IsPathRooted(path)) return false;
        var segments = path.Split(new[] { '/', '\\' }, StringSplitOptions.RemoveEmptyEntries);
        return !segments.Any(s => s == ".." || s.Contains(':'));
    }
}

