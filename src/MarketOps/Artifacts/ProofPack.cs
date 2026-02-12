using System;
using System.Collections.Generic;

namespace MarketOps.Artifacts;

/// <summary>
/// Schema records for the MarketOps Proof Pack — distribution-grade evidence packaging.
/// A Proof Pack binds multiple run artifacts into a sealed, verifiable bundle.
/// </summary>

// ── Run Manifest ─────────────────────────────────────────────────────

public sealed record RunManifest(
    string SchemaVersion,
    string RunId,
    string TenantId,
    DateTimeOffset IssuedAt,
    string Mode,
    string Scenario,
    SourceInfo Source,
    ManifestScope Scope,
    InvariantSet Invariants,
    List<ArtifactEntry> Artifacts,
    ManifestRollup Rollup,
    ManifestSignature? ManifestSignature = null);

// ── Manifest Signature ──────────────────────────────────────────────

/// <summary>
/// Ed25519 signature block for a RUN_MANIFEST.
/// The signature is computed over the canonical JSON of the manifest
/// EXCLUDING the manifestSignature property itself.
/// </summary>
public sealed record ManifestSignature(
    string Alg,
    string KeyId,
    string PublicKeyPath,
    string Signature,
    DateTimeOffset SignedAt);

public sealed record SourceInfo(
    string Host,
    string Service,
    string? ServiceVersion,
    GitInfo? Git);

public sealed record GitInfo(
    string? Repo,
    string? Commit,
    string? Tag);

public sealed record ManifestScope(
    string TenantId,
    List<string> Repos,
    int ReposTotal,
    int IssuesTotal);

public sealed record InvariantSet(
    bool DryRunBlocksAllSideEffects,
    bool FcOnlyMintEnforceable,
    bool PortsAreGateways);

public sealed record ArtifactEntry(
    string Name,
    string Path,
    string ContentType,
    string Sha256,
    long Bytes);

public sealed record ManifestRollup(
    int IntentsTotal,
    int BlockedByMode,
    int BlockedByPolicy,
    string PolicyVerdict,
    string RecommendationOutcome);

// ── Pack Index ───────────────────────────────────────────────────────

public sealed record PackIndex(
    string SchemaVersion,
    DateTimeOffset CreatedAt,
    string PackId,
    string TenantId,
    List<PackRunEntry> Runs,
    string PackSha256);

public sealed record PackRunEntry(
    string RunId,
    string Scenario,
    string Mode,
    string Path,
    string Sha256);

