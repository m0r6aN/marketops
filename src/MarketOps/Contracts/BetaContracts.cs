using System;
using System.Collections.Generic;

namespace MarketOps.Contracts;

// NOTE (ca-001): added by w0-contracts-beta alongside contracts/*.json.
// BCL-only records mirroring the JSON-schema contracts; no behavior.

/// <summary>
/// Access-restricted beta tenant. Mirrors contracts/BetaTenant.json.
/// </summary>
public sealed record BetaTenant(
    string TenantId,
    string DisplayName,
    string BetaStatus,
    bool PublicSafe,
    DateTimeOffset CreatedAtUtc);

/// <summary>
/// Feature entitlement for a tenant. Mirrors contracts/Entitlement.json.
/// A lapsed or cancelled entitlement gates beta features off.
/// </summary>
public sealed record Entitlement(
    string TenantId,
    string Plan,
    IReadOnlyList<string> Features,
    string Status,
    DateTimeOffset? ExpiresAtUtc,
    DateTimeOffset UpdatedAtUtc);

/// <summary>
/// One paraphrase evaluation inside a claim eval.
/// </summary>
public sealed record ClaimParaphrase(
    string Text,
    string Verdict);

/// <summary>
/// Claim evaluation record. Mirrors contracts/ClaimEval.json.
/// </summary>
public sealed record ClaimEval(
    string ClaimId,
    string ClaimText,
    string? TenantId,
    IReadOnlyList<ClaimParaphrase> Paraphrases,
    string Verdict,
    IReadOnlyList<string>? Reasons = null,
    DateTimeOffset? EvaluatedAtUtc = null);

/// <summary>
/// Email compliance gate outcome. Mirrors contracts/ComplianceCheck.json.
/// A blocked check must never reach a send adapter.
/// </summary>
public sealed record ComplianceCheck(
    string TenantId,
    string? CampaignId,
    string ConsentBasis,
    bool SuppressionChecked,
    bool UnsubscribeLinkPresent,
    bool SenderAuthPass,
    bool PhysicalAddressPresent,
    string Verdict,
    IReadOnlyList<string>? BlockedReasons = null,
    DateTimeOffset? CheckedAtUtc = null);

/// <summary>
/// One sealed pipeline run inside a proofpack.
/// </summary>
public sealed record ProofpackRun(
    string RunId,
    string Mode,
    string Path,
    string Sha256);

/// <summary>
/// Proofpack manifest sealing evidence for exactly one tenant.
/// Mirrors contracts/ProofpackManifest.json.
/// </summary>
public sealed record ProofpackManifest(
    string PackId,
    string TenantId,
    DateTimeOffset CreatedAtUtc,
    IReadOnlyList<ProofpackRun> Runs,
    string PackSha256);
