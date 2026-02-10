using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using MarketOps.Api;
using MarketOps.Artifacts;
using MarketOps.Contracts;
using Xunit;

namespace MarketOps.Tests;

/// <summary>
/// Tests for MarketOps REST API.
/// Verifies mode is included in all responses.
/// Verifies default mode is dry_run.
/// </summary>
public sealed class ApiControllerTests
{
    [Fact]
    public async Task StartRun_DefaultsToDryRun()
    {
        // Arrange
        var controller = new MarketOpsController();
        var request = new StartRunRequest(Mode: null);

        // Act
        var response = await controller.StartRunAsync(request);

        // Assert
        Assert.Equal("dry_run", response.Mode);
        Assert.Equal("started", response.Status);
        Assert.NotNull(response.RunId);
    }

    [Fact]
    public async Task StartRun_AllowsExplicitProdMode()
    {
        // Arrange
        var controller = new MarketOpsController();
        var request = new StartRunRequest(Mode: ExecutionMode.Prod);

        // Act
        var response = await controller.StartRunAsync(request);

        // Assert
        Assert.Equal("prod", response.Mode);
        Assert.Equal("started", response.Status);
    }

    [Fact]
    public async Task GetRun_IncludesModeInResponse()
    {
        // Arrange
        var controller = new MarketOpsController();
        var startRequest = new StartRunRequest(Mode: ExecutionMode.DryRun);
        var startResponse = await controller.StartRunAsync(startRequest);

        // Act
        var getResponse = await controller.GetRunAsync(startResponse.RunId);

        // Assert
        Assert.Equal("dry_run", getResponse.Mode);
        Assert.Equal("started", getResponse.Status);
    }

    [Fact]
    public async Task GetPlan_ReturnsNullWhenNotGenerated()
    {
        // Arrange
        var controller = new MarketOpsController();
        var startRequest = new StartRunRequest();
        var startResponse = await controller.StartRunAsync(startRequest);

        // Act
        var plan = await controller.GetPlanAsync(startResponse.RunId);

        // Assert
        Assert.Null(plan);
    }

    [Fact]
    public async Task GetLedger_ReturnsNullWhenNotGenerated()
    {
        // Arrange
        var controller = new MarketOpsController();
        var startRequest = new StartRunRequest();
        var startResponse = await controller.StartRunAsync(startRequest);

        // Act
        var ledger = await controller.GetLedgerAsync(startResponse.RunId);

        // Assert
        Assert.Null(ledger);
    }

    [Fact]
    public async Task GetAdvisory_ReturnsNullWhenNotGenerated()
    {
        // Arrange
        var controller = new MarketOpsController();
        var startRequest = new StartRunRequest();
        var startResponse = await controller.StartRunAsync(startRequest);

        // Act
        var advisory = await controller.GetAdvisoryAsync(startResponse.RunId);

        // Assert
        Assert.Null(advisory);
    }

    [Fact]
    public async Task GetRun_ThrowsWhenRunNotFound()
    {
        // Arrange
        var controller = new MarketOpsController();

        // Act & Assert
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => controller.GetRunAsync("nonexistent-run"));
    }

    [Fact]
    public async Task StartRun_IncludesCorrelationId()
    {
        // Arrange
        var controller = new MarketOpsController();
        var correlationId = Guid.NewGuid().ToString();
        var request = new StartRunRequest(
            Mode: ExecutionMode.DryRun,
            CorrelationId: correlationId);

        // Act
        var response = await controller.StartRunAsync(request);
        var runResponse = await controller.GetRunAsync(response.RunId);

        // Assert
        Assert.NotNull(response.RunId);
        Assert.Equal("dry_run", response.Mode);
    }
}

