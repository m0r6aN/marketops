using System;
using System.Collections.Generic;

namespace MarketOps.Contracts;

/// <summary>
/// Represents a publish packet for artifact distribution.
/// Core domain model - BCL only, no external dependencies.
/// </summary>
public sealed record PublishPacket(
    string ArtifactId,
    string ArtifactType,
    DateTimeOffset CreatedAtUtc,
    string TenantId,
    string CorrelationId,
    string ActorId,
    IReadOnlyList<string>? SourceRefs,
    PayloadRef PayloadRef,
    IReadOnlyList<string> Destinations,
    GovernanceAuditInfo? Governance = null);

/// <summary>
/// Payload reference for the artifact being published.
/// </summary>
public sealed record PayloadRef(
    string Kind,
    string Path,
    string? ContentType = null,
    string? Sha256 = null);

/// <summary>
/// Generic governance audit information.
/// Nullable metadata on decision receipts and evidence details.
/// </summary>
public sealed record GovernanceAuditInfo(
    string DecisionReceiptId,
    string DecisionOutcome,
    DateTimeOffset DecidedAtUtc,
    string ReceiptPath,
    string? EvidencePackId = null,
    string? EvidencePackPath = null,
    VerificationSummary? Verification = null);
