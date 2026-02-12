using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using MarketOps.Ports;

namespace MarketOps.Artifacts;

/// <summary>
/// Generates approver-friendly summaries from MarketOps artifacts.
/// Groups intents by repo, extracts file-level change items,
/// computes content digests, and builds scope rollup.
/// Schema: marketops.approver-summary.v1
/// </summary>
public sealed class ApproverSummaryGenerator
{
    private readonly Action<string>? _auditLog;

    public ApproverSummaryGenerator(Action<string>? auditLog = null)
    {
        _auditLog = auditLog;
    }

    public ApproverSummary Generate(
        string runId,
        string tenantId,
        string mode,
        DateTimeOffset startedAt,
        List<SideEffectIntent> intents,
        List<SideEffectReceipt> receipts)
    {
        _auditLog?.Invoke($"APPROVER_SUMMARY_GENERATE run_id={runId} tenant={tenantId}");

        var blockedByMode = intents.Count(i => i.BlockedByMode);
        var blockedByPolicy = intents.Count(i => i.BlockedByPolicy);
        var wouldExecute = intents.Count(i => !i.BlockedByMode && !i.BlockedByPolicy);

        // Group intents by repo path → one OperationSummaryItem per repo
        var topOps = intents
            .GroupBy(i => i.Target)
            .Select(group =>
            {
                var rep = group.First();
                var repoIntents = group.ToList();
                var anyByMode = repoIntents.Any(i => i.BlockedByMode);
                var anyByPolicy = repoIntents.Any(i => i.BlockedByPolicy);

                return new OperationSummaryItem(
                    IntentId: rep.Id,
                    EffectType: rep.EffectType.ToString(),
                    Target: new OperationTarget(
                        RepoPath: group.Key,
                        Branch: ExtractParam(rep, "branch") ?? "main",
                        Scope: "repo"),
                    Status: GetGroupStatus(anyByMode, anyByPolicy),
                    Blocked: new BlockedStatus(ByMode: anyByMode, ByPolicy: anyByPolicy),
                    BlockReasons: BuildBlockReasons(repoIntents),
                    Items: repoIntents.Select(BuildChangeItem).ToList());
            })
            .ToList();

        // Scope rollup — repos + issues by type
        var issuesByType = intents
            .Select(i => ExtractParam(i, "issue_type")
                         ?? (i.BlockedByPolicy ? DeterminePolicyViolationType(i) : "unknown"))
            .GroupBy(t => t)
            .ToDictionary(g => g.Key, g => g.Count());

        var distinctRepos = intents.Select(i => i.Target).Distinct().ToList();
        var scope = new ScopeRollup(
            ReposTotal: distinctRepos.Count,
            ReposWithFindings: distinctRepos.Count,
            Repos: distinctRepos,
            IssuesTotal: intents.Count,
            IssuesByType: issuesByType);

        // Policy evaluation with verdict + stable rule IDs
        var policyViolations = intents
            .Where(i => i.BlockedByPolicy)
            .Select(i =>
            {
                var violationType = DeterminePolicyViolationType(i);
                return new PolicyViolation(
                    IntentId: i.Id,
                    ViolationType: violationType,
                    RuleId: GetRuleId(violationType),
                    Reason: string.Join("; ", i.PolicyDenialReasons),
                    Recommendation: GetPolicyRecommendation(i));
            })
            .ToList();

        var verdict = policyViolations.Any(v => v.ViolationType.Contains("direct_push"))
            ? "denied"
            : policyViolations.Any()
                ? "violations_detected"
                : "clear";

        var metadata = new RunMetadata(
            Status: "completed",
            StartedAt: startedAt,
            CompletedAt: DateTimeOffset.UtcNow,
            DurationSeconds: (int)(DateTimeOffset.UtcNow - startedAt).TotalSeconds);

        // Status rollup — the "approver heatmap"
        var countsByStatus = topOps
            .GroupBy(op => op.Status)
            .ToDictionary(g => g.Key, g => g.Sum(op => op.Items.Count));

        var operations = new OperationsSummary(
            TotalIntents: intents.Count,
            BlockedByMode: blockedByMode,
            BlockedByPolicy: blockedByPolicy,
            WouldExecute: wouldExecute,
            CountsByStatus: countsByStatus,
            TopOperations: topOps);

        var policyEval = new PolicyEvaluation(
            Verdict: verdict,
            ViolationsDetected: policyViolations.Count,
            Violations: policyViolations);

        var recommendation = GenerateRecommendation(mode, policyViolations, blockedByMode);

        return new ApproverSummary(
            SchemaVersion: "marketops.approver-summary.v1",
            RunId: runId,
            TenantId: tenantId,
            Mode: mode,
            IssuedAt: DateTimeOffset.UtcNow,
            Metadata: metadata,
            Scope: scope,
            Operations: operations,
            PolicyEvaluation: policyEval,
            Recommendation: recommendation);
    }

    // ── Helpers ──────────────────────────────────────────────────────

    private static string? ExtractParam(SideEffectIntent intent, string key)
    {
        if (!intent.Parameters.TryGetValue(key, out var val) || val == null)
            return null;
        if (val is JsonElement je)
            return je.GetString();
        return val.ToString();
    }

    private static ChangeItem BuildChangeItem(SideEffectIntent intent)
    {
        var issueType = ExtractParam(intent, "issue_type")
                        ?? (intent.BlockedByPolicy ? DeterminePolicyViolationType(intent) : "unknown");
        var severity = ExtractParam(intent, "severity") ?? "medium";
        var filePath = ExtractParam(intent, "file") ?? intent.Target;
        var description = ExtractParam(intent, "description") ?? "";

        var action = issueType.StartsWith("missing_") ? "create"
                   : issueType.StartsWith("incomplete_") ? "update"
                   : "modify";

        // Content digest from description text
        string? contentDigest = null;
        if (!string.IsNullOrEmpty(description))
        {
            var bytes = Encoding.UTF8.GetBytes(description);
            using var sha = SHA256.Create();
            var hash = sha.ComputeHash(bytes);
            contentDigest = "sha256:" + Convert.ToHexString(hash).ToLowerInvariant();
        }

        // Structured details (e.g., missing README sections)
        Dictionary<string, object?>? details = null;
        if (issueType == "incomplete_readme" && description.Contains("missing sections:"))
        {
            var idx = description.IndexOf("missing sections:") + "missing sections:".Length;
            var sections = description[idx..]
                .Split(',', StringSplitOptions.TrimEntries)
                .Select(s => s.Trim().TrimStart('#').Trim())
                .Where(s => !string.IsNullOrEmpty(s))
                .ToList();
            details = new Dictionary<string, object?> { ["missingSections"] = sections };
        }

        return new ChangeItem(
            IssueType: issueType,
            Severity: severity,
            Action: action,
            Path: filePath,
            ContentDigest: contentDigest,
            Details: details);
    }

    private static List<BlockReason> BuildBlockReasons(List<SideEffectIntent> intents)
    {
        var reasons = new List<BlockReason>();
        if (intents.Any(i => i.BlockedByMode))
        {
            reasons.Add(new BlockReason(
                Code: "dry_run_blocks_side_effects",
                Message: "Dry run mode blocks all side effects."));
        }
        foreach (var intent in intents.Where(i => i.BlockedByPolicy))
        {
            foreach (var denial in intent.PolicyDenialReasons)
            {
                reasons.Add(new BlockReason(
                    Code: "policy_denial",
                    Message: denial));
            }
        }
        return reasons.DistinctBy(r => r.Code + r.Message).ToList();
    }

    private static string GetGroupStatus(bool byMode, bool byPolicy)
    {
        if (byPolicy) return "denied_by_policy";
        if (byMode) return "blocked_by_mode";
        return "would_execute";
    }

    private static string DeterminePolicyViolationType(SideEffectIntent intent)
    {
        if (intent.PolicyDenialReasons.Any(r => r.Contains("main", StringComparison.OrdinalIgnoreCase)))
            return "direct_push_to_main";
        if (intent.PolicyDenialReasons.Any(r => r.Contains("CI", StringComparison.OrdinalIgnoreCase)))
            return "ci_weakening";
        return "policy_violation";
    }

    private static string GetPolicyRecommendation(SideEffectIntent intent)
    {
        if (intent.PolicyDenialReasons.Any(r => r.Contains("main")))
            return "Use a pull request instead of direct push to main";
        if (intent.PolicyDenialReasons.Any(r => r.Contains("CI")))
            return "Review CI/workflow changes with security team";
        return "Review with governance team";
    }

    private static string GetRuleId(string violationType) => violationType switch
    {
        "direct_push_to_main" => "policy.direct_push_main.denied.v1",
        "ci_weakening"        => "policy.ci_weakening.denied.v1",
        _                     => $"policy.{violationType}.denied.v1"
    };

    private static ApprovalRecommendation GenerateRecommendation(
        string mode,
        List<PolicyViolation> violations,
        int blockedByMode)
    {
        var outcome = violations.Any()
            ? "deny"
            : mode == "dry_run"
                ? "review_ready"
                : "approve_with_conditions";

        var summary = violations.Any()
            ? $"Policy violations detected: {violations.Count} intent(s) blocked"
            : mode == "dry_run"
                ? $"Dry run preview: {blockedByMode} intent(s) blocked by mode — no changes made"
                : $"{blockedByMode} intent(s) would execute";

        var requiredActions = new List<string>();
        if (violations.Any())
            requiredActions.Add("Address policy violations before proceeding");
        requiredActions.Add("Review operation details in full ledger");

        var warnings = new List<string>();
        if (mode == "dry_run")
            warnings.Add("This is a dry-run preview; no changes will be made");

        return new ApprovalRecommendation(
            Outcome: outcome,
            Summary: summary,
            RequiredActions: requiredActions,
            Warnings: warnings);
    }
}

