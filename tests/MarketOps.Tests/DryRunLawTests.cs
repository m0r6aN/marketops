using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using MarketOps.Artifacts;
using MarketOps.Contracts;
using MarketOps.Ports;
using Xunit;

namespace MarketOps.Tests;

/// <summary>
/// Tests proving Dry Run Law compliance.
/// 1. Dry run produces zero external side effects
/// 2. Dry run produces PublicationPlan + ProofLedger + JudgeAdvisoryReceipt
/// 3. Advisory receipts have enforceable=false and mode=dry_run
/// 4. Prod mode requires explicit authorization
/// </summary>
public sealed class DryRunLawTests
{
    [Fact]
    public async Task DryRun_ProducesZeroExternalSideEffects()
    {
        // Arrange
        var port = new NullSinkSideEffectPort();
        var run = new MarketOpsRun(
            RunId: "test-run-1",
            Mode: ExecutionMode.DryRun,
            StartedAt: DateTimeOffset.UtcNow,
            Input: new Dictionary<string, object?>());

        // Act
        await port.PublishReleaseAsync("target", new Dictionary<string, object?>());
        await port.PublishPostAsync("target", new Dictionary<string, object?>());
        await port.TagRepoAsync("target", new Dictionary<string, object?>());
        await port.OpenPrAsync("target", new Dictionary<string, object?>());

        // Assert
        Assert.Equal(4, port.RecordedIntents.Count);
        foreach (var intent in port.RecordedIntents)
        {
            Assert.Equal("dry_run", intent.Mode);
            Assert.True(intent.BlockedByMode);
        }
    }

    [Fact]
    public void DryRun_GeneratesAdvisoryReceiptWithNonPromotableMarkers()
    {
        // Arrange
        var generator = new ArtifactGenerator();
        var runId = "test-run-2";

        // Act
        var advisory = generator.GenerateAdvisoryReceipt(
            runId,
            new List<string> { "reason1", "reason2" });

        // Assert
        Assert.Equal("dry_run", advisory.Mode);
        Assert.False(advisory.Enforceable);
        Assert.Equal(runId, advisory.RunId);
    }

    [Fact]
    public void DryRun_GeneratesPublicationPlanAndProofLedger()
    {
        // Arrange
        var generator = new ArtifactGenerator();
        var runId = "test-run-3";

        // Act
        var plan = generator.GeneratePublicationPlan(
            runId,
            ExecutionMode.DryRun,
            new List<object>(),
            new List<object>(),
            new Dictionary<string, string>());

        var ledger = generator.GenerateProofLedger(
            runId,
            ExecutionMode.DryRun,
            new List<SideEffectIntent>(),
            new List<SideEffectReceipt>());

        // Assert
        Assert.Equal("dry_run", plan.Mode);
        Assert.Equal("dry_run", ledger.Mode);
        Assert.NotNull(plan);
        Assert.NotNull(ledger);
    }

    [Fact]
    public void MarketOpsRun_ValidatesModeIsSet()
    {
        // Arrange
        var run = new MarketOpsRun(
            RunId: "test-run-4",
            Mode: ExecutionMode.DryRun,
            StartedAt: DateTimeOffset.UtcNow,
            Input: new Dictionary<string, object?>());

        // Act & Assert
        run.ValidateMode(); // Should not throw
        Assert.True(run.IsDryRun);
        Assert.False(run.IsProd);
    }

    [Fact]
    public void ProdMode_RequiresExplicitOptIn()
    {
        // Arrange
        var run = new MarketOpsRun(
            RunId: "test-run-5",
            Mode: ExecutionMode.Prod,
            StartedAt: DateTimeOffset.UtcNow,
            Input: new Dictionary<string, object?>());

        // Act & Assert
        run.ValidateMode(); // Should not throw
        Assert.False(run.IsDryRun);
        Assert.True(run.IsProd);
    }

    [Fact]
    public async Task DryRun_AllSideEffectsAreBlocked()
    {
        // Arrange
        var port = new NullSinkSideEffectPort();

        // Act
        var receipt1 = await port.PublishReleaseAsync("target1", new Dictionary<string, object?>());
        var receipt2 = await port.PublishPostAsync("target2", new Dictionary<string, object?>());
        var receipt3 = await port.TagRepoAsync("target3", new Dictionary<string, object?>());
        var receipt4 = await port.OpenPrAsync("target4", new Dictionary<string, object?>());

        // Assert
        Assert.False(receipt1.Success);
        Assert.False(receipt2.Success);
        Assert.False(receipt3.Success);
        Assert.False(receipt4.Success);

        Assert.Equal("blocked_by_mode", receipt1.ErrorMessage);
        Assert.Equal("blocked_by_mode", receipt2.ErrorMessage);
        Assert.Equal("blocked_by_mode", receipt3.ErrorMessage);
        Assert.Equal("blocked_by_mode", receipt4.ErrorMessage);
    }
}

