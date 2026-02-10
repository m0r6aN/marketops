using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using MarketOps.Contracts;
using MarketOps.Observability;
using Xunit;

namespace MarketOps.Tests;

/// <summary>
/// Tests for WebSocket event emission.
/// Verifies ordered event sequence.
/// Verifies mode is included in all events.
/// </summary>
public sealed class WebSocketEventTests
{
    [Fact]
    public async Task EmitRunStarted_IncludesModeAndRunId()
    {
        // Arrange
        var events = new List<MarketOpsEvent>();
        var handler = new TestEventHandler(events);
        var emitter = new WebSocketEventEmitter(handler);
        var runId = "test-run-1";

        // Act
        await emitter.EmitRunStartedAsync(runId, ExecutionMode.DryRun);

        // Assert
        Assert.Single(events);
        Assert.Equal("marketops.run.started", events[0].EventType);
        Assert.Equal(runId, events[0].RunId);
        Assert.Equal("dry_run", events[0].Mode);
    }

    [Fact]
    public async Task EmitStageStarted_IncludesStageAndMode()
    {
        // Arrange
        var events = new List<MarketOpsEvent>();
        var handler = new TestEventHandler(events);
        var emitter = new WebSocketEventEmitter(handler);

        // Act
        await emitter.EmitStageStartedAsync("run-1", ExecutionMode.DryRun, "discover");

        // Assert
        Assert.Single(events);
        Assert.Equal("marketops.stage.started", events[0].EventType);
        Assert.Equal("discover", events[0].Stage);
        Assert.Equal("dry_run", events[0].Mode);
    }

    [Fact]
    public async Task EmitExecuteBlocked_OnlyInDryRun()
    {
        // Arrange
        var events = new List<MarketOpsEvent>();
        var handler = new TestEventHandler(events);
        var emitter = new WebSocketEventEmitter(handler);

        // Act
        await emitter.EmitExecuteBlockedAsync("run-1");

        // Assert
        Assert.Single(events);
        Assert.Equal("marketops.execute.blocked", events[0].EventType);
        Assert.Equal("dry_run", events[0].Mode);
    }

    [Fact]
    public async Task EmitAdvisoryIssued_OnlyInDryRun()
    {
        // Arrange
        var events = new List<MarketOpsEvent>();
        var handler = new TestEventHandler(events);
        var emitter = new WebSocketEventEmitter(handler);

        // Act
        await emitter.EmitAdvisoryIssuedAsync("run-1");

        // Assert
        Assert.Single(events);
        Assert.Equal("marketops.judge.advisory_issued", events[0].EventType);
        Assert.Equal("dry_run", events[0].Mode);
    }

    [Fact]
    public async Task EmitReceiptIssued_OnlyInProd()
    {
        // Arrange
        var events = new List<MarketOpsEvent>();
        var handler = new TestEventHandler(events);
        var emitter = new WebSocketEventEmitter(handler);

        // Act
        await emitter.EmitReceiptIssuedAsync("run-1");

        // Assert
        Assert.Single(events);
        Assert.Equal("marketops.judge.receipt_issued", events[0].EventType);
        Assert.Equal("prod", events[0].Mode);
    }

    [Fact]
    public async Task EmitRunCompleted_IncludesFinalMode()
    {
        // Arrange
        var events = new List<MarketOpsEvent>();
        var handler = new TestEventHandler(events);
        var emitter = new WebSocketEventEmitter(handler);

        // Act
        await emitter.EmitRunCompletedAsync("run-1", ExecutionMode.Prod);

        // Assert
        Assert.Single(events);
        Assert.Equal("marketops.run.completed", events[0].EventType);
        Assert.Equal("prod", events[0].Mode);
    }

    private sealed class TestEventHandler : IWebSocketEventHandler
    {
        private readonly List<MarketOpsEvent> _events;

        public TestEventHandler(List<MarketOpsEvent> events)
        {
            _events = events;
        }

        public Task OnEventAsync(MarketOpsEvent evt)
        {
            _events.Add(evt);
            return Task.CompletedTask;
        }
    }
}

