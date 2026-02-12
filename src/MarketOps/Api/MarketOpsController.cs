using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MarketOps.Artifacts;
using MarketOps.Contracts;

namespace MarketOps.Api;

/// <summary>
/// REST API for MarketOps runs.
/// All endpoints include mode in response.
/// Default mode: dry_run (explicit opt-in for prod).
/// </summary>
public sealed class MarketOpsController
{
    private readonly Dictionary<string, MarketOpsRunState> _runs = new();
    private readonly Action<string>? _auditLog;

    public MarketOpsController(Action<string>? auditLog = null)
    {
        _auditLog = auditLog;
    }

    /// <summary>
    /// POST /marketops/runs - Start a new run.
    /// Mode defaults to dry_run. Explicit opt-in required for prod.
    /// </summary>
    public async Task<StartRunResponse> StartRunAsync(
        StartRunRequest request,
        CancellationToken ct = default)
    {
        var mode = request.Mode ?? ExecutionMode.DryRun;
        var runId = Guid.NewGuid().ToString();
        var run = new MarketOpsRun(
            RunId: runId,
            Mode: mode,
            StartedAt: DateTimeOffset.UtcNow,
            Input: request.Input ?? new Dictionary<string, object?>(),
            CorrelationId: request.CorrelationId);

        run.ValidateMode();

        var state = new MarketOpsRunState(
            Run: run,
            Plan: null,
            Ledger: null,
            Advisory: null,
            Status: "started");

        _runs[runId] = state;
        _auditLog?.Invoke($"RUN_STARTED run_id={runId} mode={mode}");

        return new StartRunResponse(
            RunId: runId,
            Mode: mode == ExecutionMode.DryRun ? "dry_run" : "prod",
            Status: "started");
    }

    /// <summary>
    /// GET /marketops/runs/{id} - Get run summary.
    /// </summary>
    public Task<GetRunResponse> GetRunAsync(string runId, CancellationToken ct = default)
    {
        if (!_runs.TryGetValue(runId, out var state))
            throw new InvalidOperationException($"Run not found: {runId}");

        return Task.FromResult(new GetRunResponse(
            RunId: runId,
            Mode: state.Run.Mode == ExecutionMode.DryRun ? "dry_run" : "prod",
            Status: state.Status,
            StartedAt: state.Run.StartedAt));
    }

    /// <summary>
    /// GET /marketops/runs/{id}/plan - Get PublicationPlan.
    /// </summary>
    public Task<PublicationPlan?> GetPlanAsync(string runId, CancellationToken ct = default)
    {
        if (!_runs.TryGetValue(runId, out var state))
            throw new InvalidOperationException($"Run not found: {runId}");

        return Task.FromResult(state.Plan);
    }

    /// <summary>
    /// GET /marketops/runs/{id}/ledger - Get ProofLedger.
    /// </summary>
    public Task<ProofLedger?> GetLedgerAsync(string runId, CancellationToken ct = default)
    {
        if (!_runs.TryGetValue(runId, out var state))
            throw new InvalidOperationException($"Run not found: {runId}");

        return Task.FromResult(state.Ledger);
    }

    /// <summary>
    /// GET /marketops/runs/{id}/advisory - Get JudgeAdvisoryReceipt (dry_run only).
    /// </summary>
    public Task<JudgeAdvisoryReceipt?> GetAdvisoryAsync(string runId, CancellationToken ct = default)
    {
        if (!_runs.TryGetValue(runId, out var state))
            throw new InvalidOperationException($"Run not found: {runId}");

        return Task.FromResult(state.Advisory);
    }

    /// <summary>
    /// GET /marketops/runs/{id}/summary - Get ApproverSummary (JSON).
    /// </summary>
    public Task<ApproverSummary> GetSummaryAsync(string runId, CancellationToken ct = default)
    {
        if (!_runs.TryGetValue(runId, out var state))
            throw new InvalidOperationException($"Run not found: {runId}");

        if (state.Ledger == null)
            throw new InvalidOperationException($"Ledger not available for run: {runId}");

        var generator = new ApproverSummaryGenerator(_auditLog);
        var summary = generator.Generate(
            runId,
            state.Run.Mode == ExecutionMode.DryRun ? "dry_run" : "prod",
            state.Run.StartedAt,
            state.Ledger.SideEffectIntents,
            state.Ledger.SideEffectReceipts);

        return Task.FromResult(summary);
    }

    /// <summary>
    /// GET /marketops/runs/{id}/summary.md - Get ApproverSummary (Markdown).
    /// </summary>
    public async Task<string> GetSummaryMarkdownAsync(string runId, CancellationToken ct = default)
    {
        var summary = await GetSummaryAsync(runId, ct);
        var renderer = new ApproverSummaryMarkdownRenderer();
        return renderer.Render(summary);
    }

    public void UpdateRunState(string runId, PublicationPlan plan, ProofLedger ledger, JudgeAdvisoryReceipt? advisory)
    {
        if (_runs.TryGetValue(runId, out var state))
        {
            _runs[runId] = state with { Plan = plan, Ledger = ledger, Advisory = advisory, Status = "completed" };
        }
    }

    /// <summary>
    /// Gets all artifacts for a run — used by ProofPackGenerator.
    /// Returns (plan, ledger, advisory, summary, summaryMarkdown) or throws if run not found.
    /// </summary>
    public async Task<ProofPackRunInput> GetRunForProofPackAsync(string runId, string scenario, CancellationToken ct = default)
    {
        if (!_runs.TryGetValue(runId, out var state))
            throw new InvalidOperationException($"Run not found: {runId}");

        if (state.Plan == null || state.Ledger == null)
            throw new InvalidOperationException($"Artifacts not available for run: {runId}");

        var summary = await GetSummaryAsync(runId, ct);
        var markdown = await GetSummaryMarkdownAsync(runId, ct);

        return new ProofPackRunInput(
            RunId: runId,
            Scenario: scenario,
            Mode: state.Run.Mode == ExecutionMode.DryRun ? "dry_run" : "prod",
            StartedAt: state.Run.StartedAt,
            Plan: state.Plan,
            Ledger: state.Ledger,
            Advisory: state.Advisory,
            Summary: summary,
            SummaryMarkdown: markdown);
    }
}

public sealed record StartRunRequest(
    ExecutionMode? Mode = null,
    Dictionary<string, object?>? Input = null,
    string? CorrelationId = null);

public sealed record StartRunResponse(string RunId, string Mode, string Status);
public sealed record GetRunResponse(string RunId, string Mode, string Status, DateTimeOffset StartedAt);

internal sealed record MarketOpsRunState(
    MarketOpsRun Run,
    PublicationPlan? Plan,
    ProofLedger? Ledger,
    JudgeAdvisoryReceipt? Advisory,
    string Status);

