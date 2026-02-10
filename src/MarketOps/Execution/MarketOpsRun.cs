using System;

namespace MarketOps.Execution;

public sealed record MarketOpsRun(
    string RunId,
    ExecutionMode Mode,
    DateTimeOffset StartedAtUtc,
    string? CorrelationId = null)
{
    public void EnsureModeIsPresent()
    {
        if (!Enum.IsDefined(Mode))
            throw new InvalidOperationException("MarketOps run mode is missing or invalid.");
    }
}
