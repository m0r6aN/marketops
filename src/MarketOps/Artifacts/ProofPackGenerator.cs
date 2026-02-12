using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using MarketOps.Security;

namespace MarketOps.Artifacts;

/// <summary>
/// Input record for a single run to include in the Proof Pack.
/// </summary>
public sealed record ProofPackRunInput(
    string RunId,
    string TenantId,
    string Scenario,
    string Mode,
    DateTimeOffset StartedAt,
    PublicationPlan Plan,
    ProofLedger Ledger,
    JudgeAdvisoryReceipt? Advisory,
    ApproverSummary Summary,
    string SummaryMarkdown);

/// <summary>
/// Generates a distribution-grade Proof Pack — deterministic evidence packaging
/// with sealed manifests, SHA-256 verification, and one-command audit capability.
/// 
/// Folder structure:
///   evidence/proofpack-v1/
///     PACK_INDEX.json
///     VERIFY.ps1
///     runs/{runId}/
///       RUN_MANIFEST.json
///       artifacts/
///         publication-plan.json
///         proof-ledger.json
///         judge-advisory-receipt.json
///         approver-summary.json
///         approver-summary.md
///       verification/
///         VERIFY.md
/// </summary>
public sealed class ProofPackGenerator
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = true
    };

    private readonly Action<string>? _auditLog;
    private readonly FcBindingVerifier? _fcVerifier;
    private readonly Ed25519Signer? _ed25519Signer;

    public ProofPackGenerator(Action<string>? auditLog = null, FcSigner? signer = null, Ed25519Signer? ed25519Signer = null)
    {
        _auditLog = auditLog;
        _fcVerifier = signer != null ? new FcBindingVerifier(signer) : null;
        _ed25519Signer = ed25519Signer;
    }

    /// <summary>
    /// Generates the full Proof Pack on disk and returns the PackIndex.
    /// </summary>
    public PackIndex Generate(string outputDir, List<ProofPackRunInput> runs)
    {
        _auditLog?.Invoke($"PROOFPACK_GENERATE runs={runs.Count} output={outputDir}");

        Directory.CreateDirectory(outputDir);

        var packRunEntries = new List<PackRunEntry>();

        foreach (var run in runs.OrderBy(r => r.RunId))
        {
            var runDir = Path.Combine(outputDir, "runs", run.RunId);
            var artifactsDir = Path.Combine(runDir, "artifacts");
            var verificationDir = Path.Combine(runDir, "verification");
            Directory.CreateDirectory(artifactsDir);
            Directory.CreateDirectory(verificationDir);

            // Write artifact files and collect entries
            var artifactEntries = WriteRunArtifacts(artifactsDir, run);

            // FC binding verification — write to verification/ folder
            if (_fcVerifier != null)
            {
                var (fcJson, fcMd) = _fcVerifier.Verify(run);
                // Use WriteAllBytes to avoid BOM — hash must match file on disk exactly
                var fcBytes = Encoding.UTF8.GetBytes(fcJson);
                File.WriteAllBytes(Path.Combine(verificationDir, "fc-binding.json"), fcBytes);
                var mdBytes = Encoding.UTF8.GetBytes(fcMd);
                File.WriteAllBytes(Path.Combine(verificationDir, "FC_BINDING.md"), mdBytes);

                // Add fc-binding.json as a verification artifact in the manifest
                artifactEntries.Add(new ArtifactEntry(
                    Name: "fc-binding.json",
                    Path: "verification/fc-binding.json",
                    ContentType: "application/json",
                    Sha256: ComputeSha256Bytes(fcBytes),
                    Bytes: fcBytes.Length));
                _auditLog?.Invoke($"PROOFPACK_FC_BINDING run={run.RunId}");
            }

            // Build run manifest (without signature — signing payload excludes the signature block)
            var unsignedManifest = BuildRunManifest(run, artifactEntries);

            // Ed25519 signing: sign canonical JSON of manifest WITHOUT manifestSignature
            RunManifest manifest;
            if (_ed25519Signer != null)
            {
                // Canonical JSON for signing — excludes manifestSignature (which is null at this point)
                var canonicalJson = FcSigner.ToCanonicalJson(unsignedManifest);
                var base64Sig = _ed25519Signer.SignCanonical(canonicalJson);

                var sigBlock = new ManifestSignature(
                    Alg: "ed25519",
                    KeyId: _ed25519Signer.KeyId,
                    PublicKeyPath: "keys/proofpack_signing_public.ed25519",
                    Signature: base64Sig,
                    SignedAt: DateTimeOffset.UtcNow);

                manifest = unsignedManifest with { ManifestSignature = sigBlock };
                _auditLog?.Invoke($"PROOFPACK_ED25519_SIGNED run={run.RunId} keyId={_ed25519Signer.KeyId}");
            }
            else
            {
                manifest = unsignedManifest;
            }

            // Write RUN_MANIFEST.json (BOM-free)
            var manifestJson = JsonSerializer.Serialize(manifest, JsonOpts);
            var manifestBytes = Encoding.UTF8.GetBytes(manifestJson);
            var manifestPath = Path.Combine(runDir, "RUN_MANIFEST.json");
            File.WriteAllBytes(manifestPath, manifestBytes);

            var manifestHash = ComputeSha256Bytes(manifestBytes);
            _auditLog?.Invoke($"PROOFPACK_RUN_MANIFEST run={run.RunId} sha256={manifestHash}");

            packRunEntries.Add(new PackRunEntry(
                RunId: run.RunId,
                Scenario: run.Scenario,
                Mode: run.Mode,
                Path: $"runs/{run.RunId}/RUN_MANIFEST.json",
                Sha256: manifestHash));

            // Write per-run VERIFY.md
            var verifyMd = GenerateRunVerifyMd(run, manifest);
            File.WriteAllText(Path.Combine(verificationDir, "VERIFY.md"), verifyMd, Encoding.UTF8);
        }

        // Compute deterministic pack seal
        // Rule: sort runs by runId ascending, concat manifest sha256 strings (no separators), SHA-256 the result
        var sortedEntries = packRunEntries.OrderBy(e => e.RunId).ToList();
        var concatHashes = string.Concat(sortedEntries.Select(e => e.Sha256));
        var packSha256 = ComputeSha256(concatHashes);

        // Single-tenant rule: all runs must share the same tenantId
        var packTenantId = runs.First().TenantId;
        if (runs.Any(r => r.TenantId != packTenantId))
            throw new InvalidOperationException(
                $"Pack is single-tenant but runs contain mixed tenantIds: " +
                string.Join(", ", runs.Select(r => r.TenantId).Distinct()));

        var packIndex = new PackIndex(
            SchemaVersion: "marketops.proofpack.index.v1",
            CreatedAt: DateTimeOffset.UtcNow,
            PackId: $"pack-{DateTimeOffset.UtcNow:yyyyMMdd-HHmmss}",
            TenantId: packTenantId,
            Runs: sortedEntries,
            PackSha256: packSha256);

        // Write PACK_INDEX.json (BOM-free)
        var packIndexJson = JsonSerializer.Serialize(packIndex, JsonOpts);
        var packIndexBytes = Encoding.UTF8.GetBytes(packIndexJson);
        File.WriteAllBytes(Path.Combine(outputDir, "PACK_INDEX.json"), packIndexBytes);

        // Ship public key with the pack
        if (_ed25519Signer != null)
        {
            var keysDir = Path.Combine(outputDir, "keys");
            _ed25519Signer.WritePublicKey(Path.Combine(keysDir, "proofpack_signing_public.ed25519"));
            _auditLog?.Invoke($"PROOFPACK_PUBLIC_KEY keyId={_ed25519Signer.KeyId}");
        }

        _auditLog?.Invoke($"PROOFPACK_SEALED packSha256={packSha256} runs={runs.Count}");

        return packIndex;
    }

    // ── Artifact Writing ─────────────────────────────────────────────

    private List<ArtifactEntry> WriteRunArtifacts(string artifactsDir, ProofPackRunInput run)
    {
        var entries = new List<ArtifactEntry>();

        entries.Add(WriteJsonArtifact(artifactsDir, "publication-plan.json", run.Plan));
        entries.Add(WriteJsonArtifact(artifactsDir, "proof-ledger.json", run.Ledger));

        if (run.Advisory != null)
            entries.Add(WriteJsonArtifact(artifactsDir, "judge-advisory-receipt.json", run.Advisory));

        entries.Add(WriteJsonArtifact(artifactsDir, "approver-summary.json", run.Summary));

        // Markdown is plain text, not JSON
        var mdBytes = Encoding.UTF8.GetBytes(run.SummaryMarkdown);
        var mdPath = Path.Combine(artifactsDir, "approver-summary.md");
        File.WriteAllBytes(mdPath, mdBytes);
        entries.Add(new ArtifactEntry(
            Name: "approver-summary.md",
            Path: $"artifacts/approver-summary.md",
            ContentType: "text/markdown",
            Sha256: ComputeSha256Bytes(mdBytes),
            Bytes: mdBytes.Length));

        return entries;
    }

    private ArtifactEntry WriteJsonArtifact(string dir, string filename, object artifact)
    {
        var json = JsonSerializer.Serialize(artifact, JsonOpts);
        var bytes = Encoding.UTF8.GetBytes(json);
        File.WriteAllBytes(Path.Combine(dir, filename), bytes);

        return new ArtifactEntry(
            Name: filename,
            Path: $"artifacts/{filename}",
            ContentType: "application/json",
            Sha256: ComputeSha256Bytes(bytes),
            Bytes: bytes.Length);
    }

    // ── Manifest Building ────────────────────────────────────────────

    private RunManifest BuildRunManifest(ProofPackRunInput run, List<ArtifactEntry> artifacts)
    {
        var summary = run.Summary;

        return new RunManifest(
            SchemaVersion: "marketops.proofpack.run-manifest.v1.3",
            RunId: run.RunId,
            TenantId: run.TenantId,
            IssuedAt: DateTimeOffset.UtcNow,
            Mode: run.Mode,
            Scenario: run.Scenario,
            Source: new SourceInfo(
                Host: Environment.MachineName,
                Service: "MarketOps.Api.Host",
                ServiceVersion: "1.0.0",
                Git: null),
            Scope: new ManifestScope(
                TenantId: run.TenantId,
                Repos: summary.Scope.Repos,
                ReposTotal: summary.Scope.ReposTotal,
                IssuesTotal: summary.Scope.IssuesTotal),
            Invariants: new InvariantSet(
                DryRunBlocksAllSideEffects: run.Mode == "dry_run",
                FcOnlyMintEnforceable: true,
                PortsAreGateways: true),
            Artifacts: artifacts,
            Rollup: new ManifestRollup(
                IntentsTotal: summary.Operations.TotalIntents,
                BlockedByMode: summary.Operations.BlockedByMode,
                BlockedByPolicy: summary.Operations.BlockedByPolicy,
                PolicyVerdict: summary.PolicyEvaluation.Verdict,
                RecommendationOutcome: summary.Recommendation.Outcome));
    }

    // ── Per-Run Verification Checklist ───────────────────────────────

    private string GenerateRunVerifyMd(ProofPackRunInput run, RunManifest manifest)
    {
        var sb = new StringBuilder();
        sb.AppendLine("# Run Verification Checklist");
        sb.AppendLine();
        sb.AppendLine($"**Run ID:** `{run.RunId}`");
        sb.AppendLine($"**Scenario:** {run.Scenario}");
        sb.AppendLine($"**Mode:** {run.Mode}");
        sb.AppendLine($"**Generated:** {DateTimeOffset.UtcNow:O}");
        sb.AppendLine();
        sb.AppendLine("## Invariant Checks");
        sb.AppendLine();
        sb.AppendLine($"- [ ] Mode is `{run.Mode}`");
        if (run.Mode == "dry_run")
        {
            sb.AppendLine($"- [ ] All {manifest.Rollup.IntentsTotal} intents have `blockedByMode=true`");
            sb.AppendLine("- [ ] Zero side-effect receipts with `success=true`");
        }
        if (manifest.Rollup.BlockedByPolicy > 0)
        {
            sb.AppendLine($"- [ ] {manifest.Rollup.BlockedByPolicy} intent(s) have `blockedByPolicy=true`");
            sb.AppendLine("- [ ] Each policy-denied intent has a `ruleId` in approver-summary");
        }
        sb.AppendLine();
        sb.AppendLine("## Artifact Integrity");
        sb.AppendLine();
        foreach (var artifact in manifest.Artifacts)
        {
            sb.AppendLine($"- [ ] `{artifact.Name}` — SHA-256: `{artifact.Sha256}` ({artifact.Bytes} bytes)");
        }
        sb.AppendLine();
        sb.AppendLine("## Policy Verdict");
        sb.AppendLine();
        sb.AppendLine($"- [ ] Verdict: `{manifest.Rollup.PolicyVerdict}`");
        sb.AppendLine($"- [ ] Recommendation: `{manifest.Rollup.RecommendationOutcome}`");
        sb.AppendLine();
        sb.AppendLine("## FC Binding");
        sb.AppendLine();
        if (_fcVerifier != null)
        {
            sb.AppendLine("- [ ] Advisory receipt is present with issuer (Federation Core)");
            sb.AppendLine("- [ ] `receipt.runId` matches manifest `runId`");
            sb.AppendLine("- [ ] `receipt.planSha256` matches SHA-256 of `publication-plan.json`");
            sb.AppendLine("- [ ] HMAC-SHA256 signature is valid");
            sb.AppendLine("- [ ] Ledger references `receiptId` and `receiptDigest`");
            sb.AppendLine("- [ ] See `verification/fc-binding.json` and `verification/FC_BINDING.md`");
        }
        else
        {
            sb.AppendLine("- [ ] ⚠️ FC binding verification not available (no signer configured)");
        }
        sb.AppendLine();
        sb.AppendLine("## Ed25519 Manifest Signature");
        sb.AppendLine();
        if (_ed25519Signer != null)
        {
            sb.AppendLine($"- [ ] Manifest signed with Ed25519 (keyId: `{_ed25519Signer.KeyId}`)");
            sb.AppendLine("- [ ] Public key shipped at `keys/proofpack_signing_public.ed25519`");
            sb.AppendLine("- [ ] Signature verifies against canonical JSON (excluding signature block)");
        }
        else
        {
            sb.AppendLine("- [ ] ⚠️ Ed25519 signing not available (no signer configured)");
        }
        sb.AppendLine();
        sb.AppendLine("## Pack Seal");
        sb.AppendLine();
        sb.AppendLine("- [ ] RUN_MANIFEST.json SHA-256 matches PACK_INDEX entry");
        sb.AppendLine("- [ ] Pack seal (packSha256) recomputes correctly");

        return sb.ToString();
    }

    // ── Hashing ──────────────────────────────────────────────────────

    private static string ComputeSha256(string text)
    {
        var bytes = Encoding.UTF8.GetBytes(text);
        return ComputeSha256Bytes(bytes);
    }

    private static string ComputeSha256Bytes(byte[] bytes)
    {
        using var sha = SHA256.Create();
        var hash = sha.ComputeHash(bytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}

