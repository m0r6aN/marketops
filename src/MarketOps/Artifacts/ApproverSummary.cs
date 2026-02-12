using System;
using System.Collections.Generic;

namespace MarketOps.Artifacts;

/// <summary>
/// Approver-friendly summary of a MarketOps run.
/// Designed for human review with safe content redaction.
/// Schema: marketops.approver-summary.v1
/// </summary>
public sealed record ApproverSummary(
    string SchemaVersion,
    string RunId,
    string Mode,
    DateTimeOffset IssuedAt,
    RunMetadata Metadata,
    ScopeRollup Scope,
    OperationsSummary Operations,
    PolicyEvaluation PolicyEvaluation,
    ApprovalRecommendation Recommendation);

public sealed record RunMetadata(
    string Status,
    DateTimeOffset StartedAt,
    DateTimeOffset? CompletedAt,
    int DurationSeconds);

public sealed record ScopeRollup(
    int ReposTotal,
    int ReposWithFindings,
    List<string> Repos,
    int IssuesTotal,
    Dictionary<string, int> IssuesByType);

public sealed record OperationsSummary(
    int TotalIntents,
    int BlockedByMode,
    int BlockedByPolicy,
    int WouldExecute,
    Dictionary<string, int> CountsByStatus,
    List<OperationSummaryItem> TopOperations);

public sealed record OperationSummaryItem(
    string IntentId,
    string EffectType,
    OperationTarget Target,
    string Status,
    BlockedStatus Blocked,
    List<BlockReason> BlockReasons,
    List<ChangeItem> Items);

public sealed record OperationTarget(
    string RepoPath,
    string Branch,
    string Scope);

public sealed record BlockedStatus(
    bool ByMode,
    bool ByPolicy);

public sealed record BlockReason(
    string Code,
    string Message);

public sealed record ChangeItem(
    string IssueType,
    string Severity,
    string Action,
    string Path,
    string? ContentDigest = null,
    Dictionary<string, object?>? Details = null,
    string? Preview = null);

public sealed record PolicyEvaluation(
    string Verdict,
    int ViolationsDetected,
    List<PolicyViolation> Violations);

public sealed record PolicyViolation(
    string IntentId,
    string ViolationType,
    string RuleId,
    string Reason,
    string Recommendation);

public sealed record ApprovalRecommendation(
    string Outcome,
    string Summary,
    List<string> RequiredActions,
    List<string> Warnings);

