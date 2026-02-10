using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MarketOps.Contracts;
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
    private readonly Action<string>? _auditLog;

    public MarketOpsPipeline(ISideEffectPort sideEffectPort, Action<string>? auditLog = null)
    {
        _sideEffectPort = sideEffectPort ?? throw new ArgumentNullException(nameof(sideEffectPort));
        _auditLog = auditLog;
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
            var discovered = await DiscoverAsync(run, ct);
            _auditLog?.Invoke($"STAGE_DISCOVER completed artifacts={discovered.Count}");

            // Stage 2: Select
            var selected = await SelectAsync(run, discovered, ct);
            _auditLog?.Invoke($"STAGE_SELECT completed candidates={selected.Count}");

            // Stage 3: Verify
            var verified = await VerifyAsync(run, selected, ct);
            _auditLog?.Invoke($"STAGE_VERIFY completed valid={verified.IsValid}");

            // Stage 4: Evaluate
            var evaluated = await EvaluateAsync(run, verified, ct);
            _auditLog?.Invoke($"STAGE_EVALUATE completed approved={evaluated.IsApproved}");

            // Stage 5: Plan
            var plan = await PlanAsync(run, evaluated, ct);
            _auditLog?.Invoke($"STAGE_PLAN completed would_ship={plan.WouldShip.Count}");

            // Stage 6: Execute (mode-dependent)
            var executed = await ExecuteAsync(run, plan, ct);
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

    private Task<List<object>> DiscoverAsync(MarketOpsRun run, CancellationToken ct)
        => Task.FromResult(new List<object>());

    private Task<List<object>> SelectAsync(MarketOpsRun run, List<object> discovered, CancellationToken ct)
        => Task.FromResult(new List<object>(discovered));

    private Task<VerificationResult> VerifyAsync(MarketOpsRun run, List<object> selected, CancellationToken ct)
        => Task.FromResult(new VerificationResult(IsValid: true, Checks: new List<string>()));

    private Task<EvaluationResult> EvaluateAsync(MarketOpsRun run, VerificationResult verified, CancellationToken ct)
        => Task.FromResult(new EvaluationResult(IsApproved: true, Policies: new List<string>()));

    private Task<PublicationPlanData> PlanAsync(MarketOpsRun run, EvaluationResult evaluated, CancellationToken ct)
        => Task.FromResult(new PublicationPlanData(
            WouldShip: new List<object>(),
            WouldNotShip: new List<object>(),
            Reasons: new Dictionary<string, string>()));

    private async Task<ExecutionResult> ExecuteAsync(MarketOpsRun run, PublicationPlanData plan, CancellationToken ct)
    {
        if (run.IsDryRun)
        {
            _auditLog?.Invoke("EXECUTE_BLOCKED mode=dry_run");
            return new ExecutionResult(Intents: new List<SideEffectIntent>(), Receipts: new List<SideEffectReceipt>());
        }

        // Prod mode: execute side effects
        return new ExecutionResult(Intents: new List<SideEffectIntent>(), Receipts: new List<SideEffectReceipt>());
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

public sealed record VerificationResult(bool IsValid, List<string> Checks);
public sealed record EvaluationResult(bool IsApproved, List<string> Policies);
public sealed record PublicationPlanData(List<object> WouldShip, List<object> WouldNotShip, Dictionary<string, string> Reasons);
public sealed record ExecutionResult(List<SideEffectIntent> Intents, List<SideEffectReceipt> Receipts);
public sealed record ProofLedgerData(string RunId, ExecutionMode Mode, List<SideEffectIntent> SideEffectIntents, List<SideEffectReceipt> SideEffectReceipts);

