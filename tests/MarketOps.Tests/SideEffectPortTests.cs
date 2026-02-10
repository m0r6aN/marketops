using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MarketOps.Execution;
using Xunit;

namespace MarketOps.Tests;

public sealed class SideEffectPortTests
{
    [Fact]
    public async Task DryRun_NullSink_RecordsIntent_AndNeverExecutesExternalAction()
    {
        var store = new InMemorySideEffectIntentStore();
        var port = new NullSinkSideEffectPort(store, () => "intent_fixed");
        var run = new MarketOpsRun("run_1", ExecutionMode.DryRun, DateTimeOffset.UtcNow, "corr_1");

        var action = await port.PublishReleaseAsync(
            run,
            SideEffectRequest.Create("github", "org/repo", new Dictionary<string, string?> { ["tag"] = "v1.0.0" }, "judge.release.authorize"),
            authorization: null);

        Assert.Null(action);
        var intents = await store.GetByRunIdAsync(run.RunId);
        var intent = Assert.Single(intents);
        Assert.Equal(ExecutionMode.DryRun, intent.Mode);
        Assert.True(intent.BlockedByMode);
        Assert.Equal("blocked_by_mode", intent.BlockedReason);
        Assert.True(intent.RequiredAuthorization.EnforceableRequired);
    }

    [Fact]
    public async Task DryRun_UsingLivePort_FailsClosed()
    {
        var port = new LiveSideEffectPort(new FixedExecutor());
        var run = new MarketOpsRun("run_2", ExecutionMode.DryRun, DateTimeOffset.UtcNow, "corr_2");

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            port.PublishPostAsync(
                run,
                SideEffectRequest.Create("wordpress", "post/1", new Dictionary<string, string?>(), "judge.post.authorize"),
                new SideEffectAuthorization("r1", true, "judge.post.authorize")));
    }

    [Fact]
    public async Task Prod_WithoutEnforceableAuthorization_FailsClosed()
    {
        var port = new LiveSideEffectPort(new FixedExecutor());
        var run = new MarketOpsRun("run_3", ExecutionMode.Prod, DateTimeOffset.UtcNow, "corr_3");

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            port.TagRepoAsync(
                run,
                SideEffectRequest.Create("git", "repo/path", new Dictionary<string, string?> { ["tag"] = "v2.0.0" }, "judge.tag.authorize"),
                new SideEffectAuthorization(
                    ReceiptId: "r2",
                    Enforceable: false,
                    ReceiptType: "judge.tag.authorize")));
    }

    [Fact]
    public async Task Prod_WithEnforceableAuthorization_ExecutesThroughBoundary()
    {
        var executor = new FixedExecutor();
        var port = new LiveSideEffectPort(executor);
        var run = new MarketOpsRun("run_4", ExecutionMode.Prod, DateTimeOffset.UtcNow, "corr_4");

        var action = await port.OpenPrAsync(
            run,
            SideEffectRequest.Create("github", "org/repo", new Dictionary<string, string?> { ["title"] = "Upgrade docs" }, "judge.pr.authorize"),
            new SideEffectAuthorization(
                ReceiptId: "r3",
                Enforceable: true,
                ReceiptType: "judge.pr.authorize"));

        Assert.NotNull(action);
        Assert.True(executor.WasCalled);
        Assert.Equal(SideEffectKind.OpenPr, action!.Kind);
    }

    [Fact]
    public void Guard_OutsidePort_Throws()
    {
        Assert.Throws<InvalidOperationException>(() => SideEffectBoundaryGuard.AssertInsidePort("publish_release"));
    }

    private sealed class FixedExecutor : ILiveSideEffectExecutor
    {
        public bool WasCalled { get; private set; }

        public Task<SideEffectAction?> ExecuteAsync(
            MarketOpsRun run,
            SideEffectKind kind,
            SideEffectRequest request,
            SideEffectAuthorization authorization,
            CancellationToken ct = default)
        {
            SideEffectBoundaryGuard.AssertInsidePort(kind.ToString());
            WasCalled = true;
            return Task.FromResult<SideEffectAction?>(new SideEffectAction(
                ActionId: "act_1",
                RunId: run.RunId,
                Kind: kind,
                Target: request.Target,
                ExecutedAtUtc: DateTimeOffset.UtcNow));
        }
    }
}
