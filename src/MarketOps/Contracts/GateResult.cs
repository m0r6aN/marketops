using System;
using System.Collections.Generic;

namespace MarketOps.Contracts;

/// <summary>
/// Failure stages in the gate evaluation pipeline.
/// Generic governance model - no vendor-specific types.
/// </summary>
public enum FailureStage
{
    Precheck,
    Decision,           // Renamed from "keon-decision"
    EvidencePack,
    Verify,
    Exception
}

/// <summary>
/// Result of gate evaluation for a publish packet.
/// Core domain model - BCL only, no external dependencies.
/// </summary>
public sealed record GateResult(
    bool Allowed,
    string? DenialCode,
    string? DenialMessage,
    FailureStage? FailureStage,
    string? PacketHashSha256,
    PublishPacket Packet,
    GovernanceEvidence? Governance)  // Renamed from "keon"
{
    /// <summary>
    /// Factory method for creating denial results.
    /// </summary>
    public static GateResult Deny(
        FailureStage stage,
        string code,
        string message,
        PublishPacket packet,
        string? packetHashSha256 = null,
        GovernanceEvidence? governance = null)
    {
        return new GateResult(
            Allowed: false,
            DenialCode: code,
            DenialMessage: message,
            FailureStage: stage,
            PacketHashSha256: packetHashSha256,
            Packet: packet,
            Governance: governance);
    }

    /// <summary>
    /// Factory method for creating approval results.
    /// </summary>
    public static GateResult Allow(
        PublishPacket packet,
        string packetHashSha256,
        GovernanceEvidence governance)
    {
        return new GateResult(
            Allowed: true,
            DenialCode: null,
            DenialMessage: null,
            FailureStage: null,
            PacketHashSha256: packetHashSha256,
            Packet: packet,
            Governance: governance);
    }
}

/// <summary>
/// Governance evidence for gate evaluation.
/// Generic replacement for Keon-specific evidence types.
/// </summary>
public sealed record GovernanceEvidence(
    string ReceiptId,
    string DecisionOutcome,
    DateTimeOffset DecidedAtUtc,
    string ReceiptCanonicalPath,
    string EvidencePackZipPath,
    VerificationSummary? VerificationSummary);

/// <summary>
/// Summary of evidence verification results.
/// Generic replacement for VerifyReportSummary.
/// </summary>
public sealed record VerificationSummary(
    bool IsValid,
    int Phase,
    IReadOnlyList<string> ErrorCodes);

