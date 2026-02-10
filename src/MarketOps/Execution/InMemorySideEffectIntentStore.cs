using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace MarketOps.Execution;

public sealed class InMemorySideEffectIntentStore : ISideEffectIntentStore
{
    private readonly ConcurrentDictionary<string, ConcurrentQueue<SideEffectIntent>> _byRunId = new();

    public Task AppendAsync(SideEffectIntent intent, CancellationToken ct = default)
    {
        ct.ThrowIfCancellationRequested();
        intent.ValidateFailClosed();
        var queue = _byRunId.GetOrAdd(intent.RunId, _ => new ConcurrentQueue<SideEffectIntent>());
        queue.Enqueue(intent);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<SideEffectIntent>> GetByRunIdAsync(string runId, CancellationToken ct = default)
    {
        ct.ThrowIfCancellationRequested();
        if (string.IsNullOrWhiteSpace(runId))
            throw new ArgumentException("runId is required.", nameof(runId));

        if (!_byRunId.TryGetValue(runId, out var queue))
            return Task.FromResult<IReadOnlyList<SideEffectIntent>>(Array.Empty<SideEffectIntent>());

        return Task.FromResult<IReadOnlyList<SideEffectIntent>>(queue.ToArray().ToList());
    }
}
