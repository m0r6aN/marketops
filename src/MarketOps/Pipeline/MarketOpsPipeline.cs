using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MarketOps.Contracts;
using MarketOps.Pipeline;
using MarketOps.Policy;
using MarketOps.Ports;

namespace MarketOps.Pipeline;

/// <summary>
/// Orchestrates the MarketOps pipeline with dual-mode execution.
/// Identical stages for both dry_run and prod modes.
/// Mode is enforced at every boundary.
/// </summary>
public sealed class MarketOpsPipeline
{
    private readonly ISideEffectPort _sideEffectPort;
    private readonly PipelineStages _stages;
    private readonly Action<string>? _auditLog;

    public MarketOpsPipeline(ISideEffectPort sideEffectPort, Action<string>? auditLog = null)
    {
        _sideEffectPort = sideEffectPort ?? throw new ArgumentNullException(nameof(sideEffectPort));
        _auditLog = auditLog;
        _stages = new PipelineStages(auditLog);
    }

    /// <summary>
    /// Executes the full pipeline: Discover → Select → Verify → Evaluate → Plan → Execute → Seal
    /// </summary>
    public async Task<PipelineResult> ExecuteAsync(MarketOpsRun run, CancellationToken ct = default)
    {
        run.ValidateMode();
        _auditLog?.Invoke($"PIPELINE_START mode={run.Mode} run_id={run.RunId}");

        try
        {
            // Stage 1: Discover
            var discovered = await _stages.DiscoverAsync(run, ct);
            _auditLog?.Invoke($"STAGE_DISCOVER completed artifacts={discovered.Artifacts.Count}");

            // Stage 2: Select
            var selected = await _stages.SelectAsync(run, discovered, ct);
            _auditLog?.Invoke($"STAGE_SELECT completed candidates={selected.Candidates.Count}");

            // Stage 3: Verify
            var verified = await _stages.VerifyAsync(run, selected, ct);
            _auditLog?.Invoke($"STAGE_VERIFY completed valid={verified.IsValid}");

            // Stage 4: Evaluate
            var evaluated = await _stages.EvaluateAsync(run, verified, ct);
            _auditLog?.Invoke($"STAGE_EVALUATE completed approved={evaluated.IsApproved}");

            // Stage 5: Plan
            var plan = await _stages.PlanAsync(run, verified, evaluated, ct);
            _auditLog?.Invoke($"STAGE_PLAN completed would_ship={plan.WouldShip.Count}");

            // Stage 6: Execute (mode-dependent)
            var executed = await ExecuteAsync(run, plan, evaluated, ct);
            _auditLog?.Invoke($"STAGE_EXECUTE completed mode={run.Mode}");

            // Stage 7: Seal
            var ledger = await SealAsync(run, executed, ct);
            _auditLog?.Invoke($"STAGE_SEAL completed ledger_id={ledger.RunId}");

            return new PipelineResult(
                Success: true,
                RunId: run.RunId,
                Mode: run.Mode,
                Plan: plan,
                Ledger: ledger,
                ErrorMessage: null);
        }
        catch (Exception ex)
        {
            _auditLog?.Invoke($"PIPELINE_FAILED mode={run.Mode} error={ex.Message}");
            return new PipelineResult(
                Success: false,
                RunId: run.RunId,
                Mode: run.Mode,
                Plan: null,
                Ledger: null,
                ErrorMessage: ex.Message);
        }
    }



    private async Task<ExecutionResult> ExecuteAsync(MarketOpsRun run, PublicationPlanData plan, EvaluationResult evaluated, CancellationToken ct)
    {
        var receipts = new List<SideEffectReceipt>();

        // Use the evaluated intents (which include policy-denied ones) instead of regenerating.
        // This ensures violation intents created during policy evaluation reach the ledger.
        var intents = evaluated.EvaluatedIntents;

        foreach (var intent in intents)
        {
            if (intent.BlockedByMode || intent.BlockedByPolicy)
            {
                // Blocked → generate a blocked receipt (no external side effect)
                var blockedReason = intent.BlockedByPolicy ? "blocked_by_policy" : "blocked_by_mode";
                receipts.Add(new SideEffectReceipt(
                    Id: Guid.NewGuid().ToString(),
                    Mode: intent.Mode,
                    EffectType: intent.EffectType,
                    Target: intent.Target,
                    Success: false,
                    ErrorMessage: blockedReason,
                    ExecutedAt: DateTimeOffset.UtcNow));
            }
            else
            {
                // Not blocked → route through ISideEffectPort
                var receipt = await _sideEffectPort.OpenPrAsync(
                    intent.Target,
                    intent.Parameters,
                    ct);
                receipts.Add(receipt);
            }
        }

        _auditLog?.Invoke($"EXECUTE_COMPLETE mode={run.Mode} intents={intents.Count} receipts={receipts.Count}");
        return new ExecutionResult(Intents: intents, Receipts: receipts);
    }

    private Task<ProofLedgerData> SealAsync(MarketOpsRun run, ExecutionResult executed, CancellationToken ct)
        => Task.FromResult(new ProofLedgerData(
            RunId: run.RunId,
            Mode: run.Mode,
            SideEffectIntents: executed.Intents,
            SideEffectReceipts: executed.Receipts));
}

public sealed record PipelineResult(
    bool Success,
    string RunId,
    ExecutionMode Mode,
    PublicationPlanData? Plan,
    ProofLedgerData? Ledger,
    string? ErrorMessage);

public sealed record VerificationResult(bool IsValid, List<string> Checks, List<ArtifactMetadata> Candidates);
public sealed record EvaluationResult(bool IsApproved, List<string> Policies, List<SideEffectIntent> EvaluatedIntents);
public sealed record PublicationPlanData(List<object> WouldShip, List<object> WouldNotShip, Dictionary<string, string> Reasons);
public sealed record ExecutionResult(List<SideEffectIntent> Intents, List<SideEffectReceipt> Receipts);
public sealed record ProofLedgerData(string RunId, ExecutionMode Mode, List<SideEffectIntent> SideEffectIntents, List<SideEffectReceipt> SideEffectReceipts);

