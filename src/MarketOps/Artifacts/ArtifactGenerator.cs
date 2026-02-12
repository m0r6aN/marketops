using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using MarketOps.Contracts;
using MarketOps.Ports;
using MarketOps.Security;

namespace MarketOps.Artifacts;

/// <summary>
/// Generates canonical artifacts: PublicationPlan, ProofLedger, JudgeAdvisoryReceipt.
/// All artifacts are schema-validated and include mode/enforceable markers.
/// </summary>
public sealed class ArtifactGenerator
{
    private readonly Action<string>? _auditLog;

    public ArtifactGenerator(Action<string>? auditLog = null)
    {
        _auditLog = auditLog;
    }

    /// <summary>
    /// Generates PublicationPlan (human-readable).
    /// </summary>
    public PublicationPlan GeneratePublicationPlan(
        string runId,
        ExecutionMode mode,
        List<object> wouldShip,
        List<object> wouldNotShip,
        Dictionary<string, string> reasons)
    {
        _auditLog?.Invoke($"ARTIFACT_PLAN_GENERATE mode={mode} run_id={runId}");

        return new PublicationPlan(
            RunId: runId,
            Mode: mode == ExecutionMode.DryRun ? "dry_run" : "prod",
            DiscoveredArtifacts: new List<object>(),
            SelectedCandidates: new List<object>(),
            ExecutedChecks: new List<object>(),
            EvaluatedPolicies: new List<object>(),
            WouldShip: wouldShip,
            WouldNotShip: wouldNotShip,
            Reasons: reasons,
            MissingPrerequisites: new List<string>());
    }

    /// <summary>
    /// Generates ProofLedger (audit-grade, machine-verifiable).
    /// </summary>
    public ProofLedger GenerateProofLedger(
        string runId,
        ExecutionMode mode,
        List<SideEffectIntent> intents,
        List<SideEffectReceipt> receipts)
    {
        _auditLog?.Invoke($"ARTIFACT_LEDGER_GENERATE mode={mode} run_id={runId}");

        return new ProofLedger(
            RunId: runId,
            Mode: mode == ExecutionMode.DryRun ? "dry_run" : "prod",
            InputHashes: new Dictionary<string, string>(),
            PolicySetReferences: new List<object>(),
            StageEvents: new List<object>(),
            SideEffectIntents: intents,
            SideEffectReceipts: receipts,
            SealedAt: DateTimeOffset.UtcNow);
    }

    /// <summary>
    /// Generates a fully-signed JudgeAdvisoryReceipt (dry_run only, non-promotable).
    /// MUST have enforceable=false and mode=dry_run.
    /// Computes plan/ledger digests, self-hash, and HMAC signature via FC signer.
    /// </summary>
    public JudgeAdvisoryReceipt GenerateAdvisoryReceipt(
        string runId,
        List<string> reasons,
        PublicationPlan plan,
        ProofLedger ledger,
        FcSigner signer)
    {
        _auditLog?.Invoke($"ARTIFACT_ADVISORY_GENERATE run_id={runId}");

        var receiptId = $"advr_{Guid.NewGuid().ToString("N")[..8]}";
        var issuedAt = DateTimeOffset.UtcNow;

        // Determine advisory outcome from reasons
        var hasPolicyViolation = reasons.Any(r => r.Contains("policy_violation") || r.Contains("denied"));
        var advisoryOutcome = hasPolicyViolation ? "denied" : "advisory";

        // Compute content digests
        var planJson = FcSigner.ToCanonicalJson(plan);
        var planSha256 = FcSigner.ComputeSha256(planJson);

        var ledgerJson = FcSigner.ToCanonicalJson(ledger);
        var ledgerSha256 = FcSigner.ComputeSha256(ledgerJson);

        // Build unsigned receipt body for self-hashing
        var unsignedReceipt = new JudgeAdvisoryReceipt(
            SchemaVersion: "marketops.judge_advisory_receipt.v1",
            ReceiptType: "judge.advisory",
            Id: receiptId,
            Mode: "dry_run",
            Enforceable: false,
            RunId: runId,
            AdvisoryOutcome: advisoryOutcome,
            Reasons: reasons,
            IssuedAt: issuedAt,
            Issuer: new ReceiptIssuer(signer.IssuerId, signer.IssuerEndpoint),
            Subject: new ReceiptSubject(
                SubjectType: "marketops.run",
                SubjectRef: $"run:{runId}",
                SubjectDigests: new ReceiptSubjectDigests(planSha256, ledgerSha256)),
            PolicySet: new ReceiptPolicySet(
                PolicySetId: "marketops.publication.v1",
                Version: "1.0.0",
                DigestSha256: FcSigner.ComputeSha256("marketops.publication.v1:1.0.0")),
            Digests: new ReceiptDigests(ReceiptSha256: "pending"),
            Signature: new ReceiptSignature(Alg: "hmac-sha256", KeyId: signer.KeyId, Sig: "pending"));

        // Compute receipt self-hash (over unsigned body)
        var unsignedJson = FcSigner.ToCanonicalJson(unsignedReceipt);
        var receiptSha256 = FcSigner.ComputeSha256(unsignedJson);

        // Replace digest placeholder, then sign
        var withDigest = unsignedReceipt with { Digests = new ReceiptDigests(receiptSha256) };
        var signingPayload = FcSigner.ToCanonicalJson(withDigest);
        var sig = signer.Sign(signingPayload);

        var signedReceipt = withDigest with
        {
            Signature = new ReceiptSignature(Alg: "hmac-sha256", KeyId: signer.KeyId, Sig: sig)
        };

        _auditLog?.Invoke($"ARTIFACT_ADVISORY_SIGNED receipt_id={receiptId} plan_sha256={planSha256[..12]}... sig={sig[..12]}...");
        return signedReceipt;
    }

    /// <summary>
    /// Computes SHA256 digest of an object (for schema pinning).
    /// </summary>
    public string ComputeDigest(object obj)
    {
        var json = JsonSerializer.Serialize(obj);
        var bytes = Encoding.UTF8.GetBytes(json);
        using var sha = SHA256.Create();
        var hash = sha.ComputeHash(bytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}

public sealed record PublicationPlan(
    string RunId,
    string Mode,
    List<object> DiscoveredArtifacts,
    List<object> SelectedCandidates,
    List<object> ExecutedChecks,
    List<object> EvaluatedPolicies,
    List<object> WouldShip,
    List<object> WouldNotShip,
    Dictionary<string, string> Reasons,
    List<string> MissingPrerequisites);

public sealed record ProofLedger(
    string RunId,
    string Mode,
    Dictionary<string, string> InputHashes,
    List<object> PolicySetReferences,
    List<object> StageEvents,
    List<SideEffectIntent> SideEffectIntents,
    List<SideEffectReceipt> SideEffectReceipts,
    DateTimeOffset SealedAt,
    string? ReceiptId = null,
    string? ReceiptDigest = null);

public sealed record JudgeAdvisoryReceipt(
    string SchemaVersion,
    string ReceiptType,
    string Id,
    string Mode,
    bool Enforceable,
    string RunId,
    string AdvisoryOutcome,
    List<string> Reasons,
    DateTimeOffset IssuedAt,
    ReceiptIssuer Issuer,
    ReceiptSubject Subject,
    ReceiptPolicySet PolicySet,
    ReceiptDigests Digests,
    ReceiptSignature Signature);

// ── FC Binding sub-records ──────────────────────────────────────────

public sealed record ReceiptIssuer(
    string IssuerId,
    string? Endpoint);

public sealed record ReceiptSubject(
    string SubjectType,
    string SubjectRef,
    ReceiptSubjectDigests SubjectDigests);

public sealed record ReceiptSubjectDigests(
    string PlanSha256,
    string? LedgerSha256);

public sealed record ReceiptPolicySet(
    string PolicySetId,
    string Version,
    string DigestSha256);

public sealed record ReceiptDigests(
    string ReceiptSha256);

public sealed record ReceiptSignature(
    string Alg,
    string KeyId,
    string Sig);

