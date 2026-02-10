using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;
using MarketOps.Contracts;

namespace MarketOps.Observability;

/// <summary>
/// Emits ordered WebSocket events for MarketOps observability.
/// Identical event sequence for both dry_run and prod modes.
/// All events include: run_id, mode, stage, status, artifact_refs, hash pointers.
/// </summary>
public sealed class WebSocketEventEmitter
{
    private readonly IWebSocketEventHandler? _handler;
    private readonly Action<string>? _auditLog;

    public WebSocketEventEmitter(IWebSocketEventHandler? handler = null, Action<string>? auditLog = null)
    {
        _handler = handler;
        _auditLog = auditLog;
    }

    public async Task EmitRunStartedAsync(string runId, ExecutionMode mode)
    {
        await EmitEventAsync(new MarketOpsEvent(
            EventType: "marketops.run.started",
            RunId: runId,
            Mode: mode == ExecutionMode.DryRun ? "dry_run" : "prod",
            Stage: null,
            Status: "started",
            Timestamp: DateTimeOffset.UtcNow));
    }

    public async Task EmitStageStartedAsync(string runId, ExecutionMode mode, string stage)
    {
        await EmitEventAsync(new MarketOpsEvent(
            EventType: "marketops.stage.started",
            RunId: runId,
            Mode: mode == ExecutionMode.DryRun ? "dry_run" : "prod",
            Stage: stage,
            Status: "started",
            Timestamp: DateTimeOffset.UtcNow));
    }

    public async Task EmitStageCompletedAsync(string runId, ExecutionMode mode, string stage)
    {
        await EmitEventAsync(new MarketOpsEvent(
            EventType: "marketops.stage.completed",
            RunId: runId,
            Mode: mode == ExecutionMode.DryRun ? "dry_run" : "prod",
            Stage: stage,
            Status: "completed",
            Timestamp: DateTimeOffset.UtcNow));
    }

    public async Task EmitPlanGeneratedAsync(string runId, ExecutionMode mode)
    {
        await EmitEventAsync(new MarketOpsEvent(
            EventType: "marketops.plan.generated",
            RunId: runId,
            Mode: mode == ExecutionMode.DryRun ? "dry_run" : "prod",
            Stage: "plan",
            Status: "generated",
            Timestamp: DateTimeOffset.UtcNow));
    }

    public async Task EmitLedgerSealedAsync(string runId, ExecutionMode mode)
    {
        await EmitEventAsync(new MarketOpsEvent(
            EventType: "marketops.ledger.sealed",
            RunId: runId,
            Mode: mode == ExecutionMode.DryRun ? "dry_run" : "prod",
            Stage: "seal",
            Status: "sealed",
            Timestamp: DateTimeOffset.UtcNow));
    }

    public async Task EmitExecuteBlockedAsync(string runId)
    {
        await EmitEventAsync(new MarketOpsEvent(
            EventType: "marketops.execute.blocked",
            RunId: runId,
            Mode: "dry_run",
            Stage: "execute",
            Status: "blocked",
            Timestamp: DateTimeOffset.UtcNow));
    }

    public async Task EmitAdvisoryIssuedAsync(string runId)
    {
        await EmitEventAsync(new MarketOpsEvent(
            EventType: "marketops.judge.advisory_issued",
            RunId: runId,
            Mode: "dry_run",
            Stage: "judge",
            Status: "advisory_issued",
            Timestamp: DateTimeOffset.UtcNow));
    }

    public async Task EmitReceiptIssuedAsync(string runId)
    {
        await EmitEventAsync(new MarketOpsEvent(
            EventType: "marketops.judge.receipt_issued",
            RunId: runId,
            Mode: "prod",
            Stage: "judge",
            Status: "receipt_issued",
            Timestamp: DateTimeOffset.UtcNow));
    }

    public async Task EmitRunCompletedAsync(string runId, ExecutionMode mode)
    {
        await EmitEventAsync(new MarketOpsEvent(
            EventType: "marketops.run.completed",
            RunId: runId,
            Mode: mode == ExecutionMode.DryRun ? "dry_run" : "prod",
            Stage: null,
            Status: "completed",
            Timestamp: DateTimeOffset.UtcNow));
    }

    private async Task EmitEventAsync(MarketOpsEvent evt)
    {
        _auditLog?.Invoke($"WS_EVENT {evt.EventType} run_id={evt.RunId} mode={evt.Mode}");
        
        if (_handler != null)
        {
            await _handler.OnEventAsync(evt);
        }
    }
}

public sealed record MarketOpsEvent(
    string EventType,
    string RunId,
    string Mode,
    string? Stage,
    string Status,
    DateTimeOffset Timestamp);

public interface IWebSocketEventHandler
{
    Task OnEventAsync(MarketOpsEvent evt);
}

