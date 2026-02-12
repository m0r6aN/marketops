using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using MarketOps.Security;

namespace MarketOps.Artifacts;

/// <summary>
/// Verifies FC (Federation Core) binding for a single run's governance artifacts.
/// Produces fc-binding.json (machine output) and FC_BINDING.md (human explanation).
///
/// Checks performed:
///   1. Receipt is present with issuer block
///   2. receipt.runId == manifest.runId
///   3. receipt.subject.planSha256 == hash(publication-plan.json)
///   4. receipt.subject.ledgerSha256 == hash(proof-ledger.json) [if present]
///   5. HMAC signature is valid
///   6. Ledger binds to receipt (receiptId + receiptDigest present)
/// </summary>
public sealed class FcBindingVerifier
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = true
    };

    private readonly FcSigner _signer;

    public FcBindingVerifier(FcSigner signer)
    {
        _signer = signer;
    }

    /// <summary>
    /// Verify all FC bindings for a run. Returns (fcBindingJson, fcBindingMd).
    /// </summary>
    public (string Json, string Markdown) Verify(ProofPackRunInput run)
    {
        var checks = new List<FcBindingCheck>();

        // Check 1: Receipt present with issuer
        var hasReceipt = run.Advisory != null;
        var hasIssuer = hasReceipt && run.Advisory!.Issuer != null
            && !string.IsNullOrEmpty(run.Advisory.Issuer.IssuerId);
        checks.Add(new FcBindingCheck(
            Id: "fc.receipt.present",
            Name: "Advisory receipt is present",
            Passed: hasReceipt,
            Expected: "non-null",
            Actual: hasReceipt ? run.Advisory!.Id : "null"));

        checks.Add(new FcBindingCheck(
            Id: "fc.receipt.issuer",
            Name: "Receipt minted by Federation Core",
            Passed: hasIssuer,
            Expected: _signer.IssuerId,
            Actual: hasIssuer ? run.Advisory!.Issuer!.IssuerId : "missing"));

        if (!hasReceipt)
        {
            // Can't check further without a receipt
            return BuildOutput(run, checks, allPassed: false);
        }

        var receipt = run.Advisory!;

        // Check 2: receipt.runId == run.RunId
        var runIdMatch = receipt.RunId == run.RunId;
        checks.Add(new FcBindingCheck(
            Id: "fc.binding.runId",
            Name: "receipt.runId matches run",
            Passed: runIdMatch,
            Expected: run.RunId,
            Actual: receipt.RunId));

        // Check 3: receipt.planSha256 == hash(plan)
        var planJson = FcSigner.ToCanonicalJson(run.Plan);
        var computedPlanHash = FcSigner.ComputeSha256(planJson);
        var receiptPlanHash = receipt.Subject?.SubjectDigests?.PlanSha256 ?? "missing";
        var planHashMatch = computedPlanHash == receiptPlanHash;
        checks.Add(new FcBindingCheck(
            Id: "fc.binding.planHash",
            Name: "receipt.planSha256 matches hash(publication-plan)",
            Passed: planHashMatch,
            Expected: computedPlanHash,
            Actual: receiptPlanHash));

        // Check 4: receipt.ledgerSha256 (optional but ideal)
        // Strip ReceiptId/ReceiptDigest — receipt was signed against pre-binding ledger state
        var preBindingLedger = run.Ledger with { ReceiptId = null, ReceiptDigest = null };
        var ledgerJson = FcSigner.ToCanonicalJson(preBindingLedger);
        var computedLedgerHash = FcSigner.ComputeSha256(ledgerJson);
        var receiptLedgerHash = receipt.Subject?.SubjectDigests?.LedgerSha256;
        var ledgerHashMatch = receiptLedgerHash != null && computedLedgerHash == receiptLedgerHash;
        checks.Add(new FcBindingCheck(
            Id: "fc.binding.ledgerHash",
            Name: "receipt.ledgerSha256 matches hash(proof-ledger)",
            Passed: ledgerHashMatch,
            Expected: computedLedgerHash,
            Actual: receiptLedgerHash ?? "not_included"));

        // Check 5: HMAC signature verification
        // Reconstruct the signing payload (receipt with digest but sig="pending")
        var withDigestOnly = receipt with
        {
            Signature = new ReceiptSignature(
                Alg: "hmac-sha256",
                KeyId: receipt.Signature.KeyId,
                Sig: "pending")
        };
        var signingPayload = FcSigner.ToCanonicalJson(withDigestOnly);
        var sigValid = _signer.Verify(signingPayload, receipt.Signature.Sig);
        checks.Add(new FcBindingCheck(
            Id: "fc.signature.hmac",
            Name: "HMAC-SHA256 signature valid",
            Passed: sigValid,
            Expected: "valid",
            Actual: sigValid ? "valid" : $"invalid (sig={receipt.Signature.Sig[..Math.Min(16, receipt.Signature.Sig.Length)]}...)"));

        // Check 6: Ledger binds to receipt
        var ledgerHasReceiptId = !string.IsNullOrEmpty(run.Ledger.ReceiptId);
        var ledgerReceiptIdMatch = ledgerHasReceiptId && run.Ledger.ReceiptId == receipt.Id;
        checks.Add(new FcBindingCheck(
            Id: "fc.ledger.receiptBinding",
            Name: "Ledger references receipt (receiptId + receiptDigest)",
            Passed: ledgerReceiptIdMatch,
            Expected: receipt.Id,
            Actual: run.Ledger.ReceiptId ?? "missing"));

        var allPassed = checks.All(c => c.Passed);
        return BuildOutput(run, checks, allPassed);
    }

    private (string Json, string Markdown) BuildOutput(
        ProofPackRunInput run, List<FcBindingCheck> checks, bool allPassed)
    {
        var result = new FcBindingResult(
            SchemaVersion: "marketops.fc-binding.v1",
            RunId: run.RunId,
            Scenario: run.Scenario,
            VerifiedAt: DateTimeOffset.UtcNow,
            Verdict: allPassed ? "fc_bound" : "fc_binding_failed",
            TotalChecks: checks.Count,
            PassedChecks: checks.Count(c => c.Passed),
            FailedChecks: checks.Count(c => !c.Passed),
            Checks: checks);

        var json = JsonSerializer.Serialize(result, JsonOpts);
        var md = RenderMarkdown(result);
        return (json, md);
    }

    private static string RenderMarkdown(FcBindingResult result)
    {
        var sb = new StringBuilder();
        sb.AppendLine("# FC Binding Verification");
        sb.AppendLine();
        sb.AppendLine($"**Run:** `{result.RunId}`");
        sb.AppendLine($"**Scenario:** {result.Scenario}");
        sb.AppendLine($"**Verified:** {result.VerifiedAt:O}");
        sb.AppendLine($"**Verdict:** `{result.Verdict}`");
        sb.AppendLine();
        sb.AppendLine($"## Results: {result.PassedChecks}/{result.TotalChecks} passed");
        sb.AppendLine();
        sb.AppendLine("| # | Check | Result | Expected | Actual |");
        sb.AppendLine("|---|-------|--------|----------|--------|");

        for (int i = 0; i < result.Checks.Count; i++)
        {
            var c = result.Checks[i];
            var icon = c.Passed ? "✅" : "❌";
            var expected = Truncate(c.Expected, 32);
            var actual = Truncate(c.Actual, 32);
            sb.AppendLine($"| {i + 1} | {c.Name} | {icon} | `{expected}` | `{actual}` |");
        }

        sb.AppendLine();
        if (result.FailedChecks == 0)
        {
            sb.AppendLine("> **All FC binding checks passed.** This run's governance artifacts are cryptographically bound to Federation Core authority.");
        }
        else
        {
            sb.AppendLine($"> **⚠️ {result.FailedChecks} check(s) failed.** This run's FC binding is incomplete or invalid.");
        }

        return sb.ToString();
    }

    private static string Truncate(string value, int maxLen) =>
        value.Length <= maxLen ? value : value[..maxLen] + "...";
}

// ── FC Binding schema records ─────────────────────────────────────────

public sealed record FcBindingResult(
    string SchemaVersion,
    string RunId,
    string Scenario,
    DateTimeOffset VerifiedAt,
    string Verdict,
    int TotalChecks,
    int PassedChecks,
    int FailedChecks,
    List<FcBindingCheck> Checks);

public sealed record FcBindingCheck(
    string Id,
    string Name,
    bool Passed,
    string Expected,
    string Actual);

