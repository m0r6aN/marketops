using System;

namespace MarketOps.Contracts;

public enum FailureStage
{
    Precheck,
    KeonDecision,
    Execution,
    EvidencePack,
    Verify,
    Exception
}

public sealed record GateResult(
    bool Allowed,
    string? DenialCode,
    string? DenialMessage,
    FailureStage? FailureStage,
    string? PacketHashSha256,
    PublishPacket Packet,
    GateKeonEvidence? Keon)
{
    public static GateResult Deny(
        FailureStage stage,
        string code,
        string message,
        PublishPacket packet,
        string? packetHashSha256,
        GateKeonEvidence? keon)
    {
        return new GateResult(false, code, message, stage, packetHashSha256, packet, keon);
    }
}

public sealed record GateKeonEvidence(
    string ReceiptId,
    string DecisionOutcome,
    DateTimeOffset DecidedAtUtc,
    string ReceiptCanonicalPath,
    string EvidencePackZipPath,
    VerifyReportSummary? VerifyReportSummary);
