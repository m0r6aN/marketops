using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MarketOps.Contracts;
using MarketOps.Discovery;
using MarketOps.Policy;
using MarketOps.Ports;

namespace MarketOps.Pipeline;

/// <summary>
/// Encapsulates all pipeline stages.
/// Each stage is identical for both dry_run and prod modes.
/// </summary>
public sealed class PipelineStages
{
    private readonly Action<string>? _auditLog;

    public PipelineStages(Action<string>? auditLog = null)
    {
        _auditLog = auditLog;
    }

    /// <summary>
    /// Stage 1: Discover - Find all hygiene issues in provided repos.
    /// </summary>
    public async Task<DiscoveredArtifacts> DiscoverAsync(
        MarketOpsRun run,
        CancellationToken ct = default)
    {
        _auditLog?.Invoke($"STAGE_DISCOVER_START mode={run.Mode}");

        var artifacts = new List<ArtifactMetadata>();
        var scanner = new RepoScanner(_auditLog);

        // Extract repo paths from input
        if (run.Input.TryGetValue("repos", out var reposObj))
        {
            _auditLog?.Invoke($"DISCOVER_REPOS_FOUND type={reposObj?.GetType().Name}");

            // Handle different types of repo collections
            var repoPaths = new List<string>();

            // Handle JsonElement (from JSON deserialization)
            if (reposObj is System.Text.Json.JsonElement jsonElem)
            {
                if (jsonElem.ValueKind == System.Text.Json.JsonValueKind.Array)
                {
                    foreach (var item in jsonElem.EnumerateArray())
                    {
                        var repoPath = item.GetString();
                        if (!string.IsNullOrEmpty(repoPath))
                            repoPaths.Add(repoPath);
                    }
                }
                else if (jsonElem.ValueKind == System.Text.Json.JsonValueKind.String)
                {
                    var repoPath = jsonElem.GetString();
                    if (!string.IsNullOrEmpty(repoPath))
                        repoPaths.Add(repoPath);
                }
            }
            // Handle IEnumerable (list, array, etc.)
            else if (reposObj is System.Collections.IEnumerable enumerable && !(reposObj is string))
            {
                foreach (var repo in enumerable)
                {
                    var repoPath = repo?.ToString();
                    if (!string.IsNullOrEmpty(repoPath))
                        repoPaths.Add(repoPath);
                }
            }
            // Handle single string
            else if (reposObj is string singleRepo && !string.IsNullOrEmpty(singleRepo))
            {
                repoPaths.Add(singleRepo);
            }

            _auditLog?.Invoke($"DISCOVER_REPO_PATHS count={repoPaths.Count}");

            foreach (var repoPath in repoPaths)
            {
                _auditLog?.Invoke($"DISCOVER_SCANNING repo_path={repoPath}");
                var issues = await scanner.ScanAsync(repoPath, ct);
                _auditLog?.Invoke($"DISCOVER_ISSUES_FOUND repo_path={repoPath} count={issues.Count}");

                foreach (var issue in issues)
                {
                    artifacts.Add(new ArtifactMetadata(
                        Id: Guid.NewGuid().ToString(),
                        Type: issue.Type,
                        Hash: issue.GetHashCode().ToString(),
                        CreatedAt: DateTimeOffset.UtcNow,
                        RepoPath: issue.RepoPath,
                        FilePath: issue.FilePath,
                        Description: issue.Description,
                        Severity: issue.Severity));
                }
            }
        }

        _auditLog?.Invoke($"STAGE_DISCOVER_END count={artifacts.Count}");
        return new DiscoveredArtifacts(artifacts);
    }

    /// <summary>
    /// Stage 2: Select - Choose which artifacts to publish.
    /// </summary>
    public async Task<SelectedCandidates> SelectAsync(
        MarketOpsRun run,
        DiscoveredArtifacts discovered,
        CancellationToken ct = default)
    {
        _auditLog?.Invoke($"STAGE_SELECT_START mode={run.Mode} input_count={discovered.Artifacts.Count}");
        
        // TODO: Implement selection logic (filtering, prioritization)
        var selected = discovered.Artifacts.ToList();
        
        _auditLog?.Invoke($"STAGE_SELECT_END selected_count={selected.Count}");
        return new SelectedCandidates(selected);
    }

    /// <summary>
    /// Stage 3: Verify - Validate hashes, manifests, provenance.
    /// </summary>
    public async Task<Pipeline.VerificationResult> VerifyAsync(
        MarketOpsRun run,
        SelectedCandidates selected,
        CancellationToken ct = default)
    {
        _auditLog?.Invoke($"STAGE_VERIFY_START mode={run.Mode} count={selected.Candidates.Count}");

        var checks = new List<string>();

        // TODO: Implement verification logic
        // - Hash validation
        // - Manifest validation
        // - Provenance checks

        var isValid = true;
        _auditLog?.Invoke($"STAGE_VERIFY_END valid={isValid} checks={checks.Count}");

        return new Pipeline.VerificationResult(isValid, checks, selected.Candidates);
    }

    /// <summary>
    /// Stage 4: Evaluate - Run governance policies.
    /// </summary>
    public async Task<Pipeline.EvaluationResult> EvaluateAsync(
        MarketOpsRun run,
        Pipeline.VerificationResult verified,
        CancellationToken ct = default)
    {
        _auditLog?.Invoke($"STAGE_EVALUATE_START mode={run.Mode}");

        var policies = new List<string>();
        var evaluator = new PolicyEvaluator(_auditLog);

        // Generate intents from verified candidates
        var intents = new List<SideEffectIntent>();
        foreach (var candidate in verified.Candidates)
        {
            var intent = new SideEffectIntent(
                Id: Guid.NewGuid().ToString(),
                Mode: run.Mode == ExecutionMode.DryRun ? "dry_run" : "prod",
                EffectType: SideEffectType.OpenPr,
                Target: candidate.RepoPath ?? "unknown",
                Parameters: new Dictionary<string, object?>
                {
                    { "file", candidate.FilePath },
                    { "issue_type", candidate.Type },
                    { "description", candidate.Description },
                    { "severity", candidate.Severity ?? "medium" }
                },
                BlockedByMode: run.IsDryRun,
                BlockedByPolicy: false,
                PolicyDenialReasons: new List<string>(),
                RequiredAuthorization: new Dictionary<string, object?> { { "enforceable_required", false } },
                Timestamp: DateTimeOffset.UtcNow);

            intents.Add(intent);
        }

        // Inject violation intent if simulateViolation flag is set (for testing policy denial)
        if (run.Input.TryGetValue("simulateViolation", out var violationObj))
        {
            // Handle JsonElement (from JSON deserialization) vs plain string
            string? violationType = null;
            if (violationObj is System.Text.Json.JsonElement jsonViolation)
                violationType = jsonViolation.GetString();
            else
                violationType = violationObj?.ToString();

            if (violationType == "direct_push_main")
            {
                var violationIntent = new SideEffectIntent(
                    Id: Guid.NewGuid().ToString(),
                    Mode: run.Mode == ExecutionMode.DryRun ? "dry_run" : "prod",
                    EffectType: SideEffectType.TagRepo,  // Not OpenPr → triggers direct-push-to-main policy
                    Target: "D:\\Repos\\marketops\\main",  // Target main branch
                    Parameters: new Dictionary<string, object?>
                    {
                        { "branch", "main" },
                        { "action", "direct_commit" },
                        { "issue_type", "direct_push_to_main" },
                        { "severity", "critical" },
                        { "description", "Test: Direct push to main (should be denied by policy)" }
                    },
                    BlockedByMode: run.IsDryRun,
                    BlockedByPolicy: false,
                    PolicyDenialReasons: new List<string>(),
                    RequiredAuthorization: new Dictionary<string, object?> { { "enforceable_required", false } },
                    Timestamp: DateTimeOffset.UtcNow);

                intents.Add(violationIntent);
                _auditLog?.Invoke($"VIOLATION_INJECTED type=direct_push_main intent_id={violationIntent.Id}");
            }
        }

        // Evaluate policies and update intents with policy results
        var policyResult = await evaluator.EvaluateAsync(intents, ct);
        policies.AddRange(policyResult.DenialReasons);

        // Update intents with policy evaluation results
        if (!policyResult.IsApproved)
        {
            for (int i = 0; i < intents.Count; i++)
            {
                var intent = intents[i];
                // Check if this specific intent was denied
                var denialReason = policyResult.DenialReasons.FirstOrDefault(r => r.Contains(intent.Id));
                if (denialReason != null)
                {
                    intents[i] = intent with
                    {
                        BlockedByPolicy = true,
                        PolicyDenialReasons = new List<string> { denialReason }
                    };
                }
            }
        }

        var isApproved = policyResult.IsApproved;
        _auditLog?.Invoke($"STAGE_EVALUATE_END approved={isApproved} policies={policies.Count}");

        return new Pipeline.EvaluationResult(isApproved, policies, intents);
    }

    /// <summary>
    /// Stage 5: Plan - Generate PublicationPlan based on policy evaluation.
    /// </summary>
    public async Task<Pipeline.PublicationPlanData> PlanAsync(
        MarketOpsRun run,
        Pipeline.VerificationResult verified,
        Pipeline.EvaluationResult evaluated,
        CancellationToken ct = default)
    {
        _auditLog?.Invoke($"STAGE_PLAN_START mode={run.Mode} approved={evaluated.IsApproved}");

        var wouldShip = new List<object>();
        var wouldNotShip = new List<object>();
        var reasons = new Dictionary<string, string>();

        // If approved, all candidates ship; otherwise, none ship
        if (evaluated.IsApproved)
        {
            wouldShip.AddRange(verified.Candidates);
            _auditLog?.Invoke($"STAGE_PLAN approved_all candidates={verified.Candidates.Count}");
        }
        else
        {
            wouldNotShip.AddRange(verified.Candidates);
            foreach (var reason in evaluated.Policies)
            {
                reasons[Guid.NewGuid().ToString()] = reason;
            }
            _auditLog?.Invoke($"STAGE_PLAN denied_all candidates={verified.Candidates.Count} reasons={evaluated.Policies.Count}");
        }

        _auditLog?.Invoke($"STAGE_PLAN_END would_ship={wouldShip.Count} would_not_ship={wouldNotShip.Count}");

        return new Pipeline.PublicationPlanData(wouldShip, wouldNotShip, reasons);
    }
}

public sealed record DiscoveredArtifacts(List<ArtifactMetadata> Artifacts);
public sealed record SelectedCandidates(List<ArtifactMetadata> Candidates);
public sealed record VerificationCheck(string Name, bool Passed, string? Details);
public sealed record ArtifactMetadata(
    string Id,
    string Type,
    string Hash,
    DateTimeOffset CreatedAt,
    string? RepoPath = null,
    string? FilePath = null,
    string? Description = null,
    string? Severity = null);

