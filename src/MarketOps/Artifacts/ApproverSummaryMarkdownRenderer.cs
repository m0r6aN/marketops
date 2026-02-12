using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace MarketOps.Artifacts;

/// <summary>
/// Renders ApproverSummary as human-friendly Markdown.
/// </summary>
public sealed class ApproverSummaryMarkdownRenderer
{
    public string Render(ApproverSummary summary)
    {
        var sb = new StringBuilder();

        sb.AppendLine("# MarketOps Approver Summary");
        sb.AppendLine();
        sb.AppendLine($"**Schema:** `{summary.SchemaVersion}`  ");
        sb.AppendLine($"**Run ID:** `{summary.RunId}`  ");
        sb.AppendLine($"**Mode:** `{summary.Mode}`  ");
        sb.AppendLine($"**Issued:** {summary.IssuedAt:O}");
        sb.AppendLine();

        RenderRecommendationBanner(sb, summary.Recommendation);
        sb.AppendLine();

        RenderScopeRollup(sb, summary.Scope);
        sb.AppendLine();

        RenderOperationsSummary(sb, summary.Operations);
        sb.AppendLine();

        if (summary.PolicyEvaluation.ViolationsDetected > 0)
        {
            RenderPolicyViolations(sb, summary.PolicyEvaluation);
            sb.AppendLine();
        }

        RenderMetadata(sb, summary.Metadata);
        return sb.ToString();
    }

    private void RenderRecommendationBanner(StringBuilder sb, ApprovalRecommendation rec)
    {
        var icon = rec.Outcome == "deny" ? "❌" : rec.Outcome == "review_ready" ? "✅" : "⚠️";
        sb.AppendLine($"## {icon} {rec.Outcome.ToUpper()}");
        sb.AppendLine();
        sb.AppendLine($"> {rec.Summary}");
        sb.AppendLine();

        if (rec.RequiredActions.Any())
        {
            sb.AppendLine("### Required Actions");
            foreach (var action in rec.RequiredActions)
                sb.AppendLine($"- [ ] {action}");
            sb.AppendLine();
        }

        if (rec.Warnings.Any())
        {
            sb.AppendLine("### ⚠️ Warnings");
            foreach (var warning in rec.Warnings)
                sb.AppendLine($"- {warning}");
            sb.AppendLine();
        }
    }

    private void RenderScopeRollup(StringBuilder sb, ScopeRollup scope)
    {
        sb.AppendLine("## Scope");
        sb.AppendLine();
        sb.AppendLine($"**{scope.ReposWithFindings}** of **{scope.ReposTotal}** repos with findings — **{scope.IssuesTotal}** total issues");
        sb.AppendLine();
        if (scope.Repos.Any())
        {
            sb.AppendLine("**Repos:** " + string.Join(", ", scope.Repos.Select(r => $"`{r}`")));
            sb.AppendLine();
        }
        sb.AppendLine("| Issue Type | Count |");
        sb.AppendLine("|------------|-------|");
        foreach (var kv in scope.IssuesByType.OrderByDescending(x => x.Value))
            sb.AppendLine($"| {kv.Key} | {kv.Value} |");
    }

    private void RenderOperationsSummary(StringBuilder sb, OperationsSummary ops)
    {
        sb.AppendLine("## Operations Summary");
        sb.AppendLine();
        sb.AppendLine("| Metric | Count |");
        sb.AppendLine("|--------|-------|");
        sb.AppendLine($"| Total Intents | {ops.TotalIntents} |");
        sb.AppendLine($"| Blocked by Mode | {ops.BlockedByMode} |");
        sb.AppendLine($"| Blocked by Policy | {ops.BlockedByPolicy} |");
        sb.AppendLine($"| Would Execute | {ops.WouldExecute} |");
        sb.AppendLine();

        if (ops.CountsByStatus.Any())
        {
            sb.AppendLine("**Status Breakdown:**");
            foreach (var kv in ops.CountsByStatus)
                sb.AppendLine($"- `{kv.Key}`: {kv.Value}");
            sb.AppendLine();
        }

        foreach (var op in ops.TopOperations)
        {
            sb.AppendLine($"### {op.EffectType} → `{op.Target.RepoPath}`");
            sb.AppendLine($"- **Branch:** `{op.Target.Branch}` | **Status:** `{op.Status}`");
            sb.AppendLine($"- **Blocked:** mode={op.Blocked.ByMode}, policy={op.Blocked.ByPolicy}");
            if (op.BlockReasons.Any())
            {
                foreach (var r in op.BlockReasons)
                    sb.AppendLine($"  - `{r.Code}`: {r.Message}");
            }
            if (op.Items.Any())
            {
                sb.AppendLine();
                sb.AppendLine("| File | Issue | Severity | Action |");
                sb.AppendLine("|------|-------|----------|--------|");
                foreach (var item in op.Items)
                    sb.AppendLine($"| `{item.Path}` | {item.IssueType} | {item.Severity} | {item.Action} |");
            }
            sb.AppendLine();
        }
    }

    private void RenderPolicyViolations(StringBuilder sb, PolicyEvaluation eval)
    {
        sb.AppendLine($"## Policy Evaluation — Verdict: `{eval.Verdict}`");
        sb.AppendLine();
        sb.AppendLine($"**{eval.ViolationsDetected}** violation(s) detected:");
        sb.AppendLine();

        foreach (var v in eval.Violations)
        {
            sb.AppendLine($"### ❌ {v.ViolationType}");
            sb.AppendLine($"- **Rule:** `{v.RuleId}`");
            sb.AppendLine($"- **Intent:** `{v.IntentId}`");
            sb.AppendLine($"- **Reason:** {v.Reason}");
            sb.AppendLine($"- **Recommendation:** {v.Recommendation}");
            sb.AppendLine();
        }
    }

    private void RenderMetadata(StringBuilder sb, RunMetadata meta)
    {
        sb.AppendLine("## Run Details");
        sb.AppendLine();
        sb.AppendLine($"- **Status:** {meta.Status}");
        sb.AppendLine($"- **Started:** {meta.StartedAt:O}");
        if (meta.CompletedAt.HasValue)
            sb.AppendLine($"- **Completed:** {meta.CompletedAt:O}");
        sb.AppendLine($"- **Duration:** {meta.DurationSeconds}s");
    }
}

