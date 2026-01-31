using System;
using System.Collections.Generic;

namespace MarketOps.Contracts;

public sealed record PublishPacket(
    string ArtifactId,
    string ArtifactType,
    DateTimeOffset CreatedAtUtc,
    string TenantId,
    string CorrelationId,
    string ActorId,
    IReadOnlyList<string> SourceRefs,
    PayloadRef PayloadRef,
    IReadOnlyList<string> Destinations,
    PublishPacketKeon? Keon = null);

public sealed record PayloadRef(
    string Kind,
    string Path,
    string? ContentType = null,
    string? Sha256 = null);

public sealed record PublishPacketKeon(
    string ReceiptId,
    string DecisionOutcome,
    DateTimeOffset DecidedAtUtc,
    string ReceiptCanonicalPath,
    string EvidencePackZipPath,
    VerifyReportSummary? VerifyReportSummary);

public sealed record VerifyReportSummary(
    bool IsValid,
    int Phase,
    IReadOnlyList<string> ErrorCodes);
