using System;
using System.Collections.Generic;

namespace MarketOps.Contracts;

/// <summary>
/// Execution mode for MarketOps runs.
/// dry_run: identical pipeline, zero external side effects
/// prod: identical pipeline, side effects execute with governance authorization
/// </summary>
public enum ExecutionMode
{
    DryRun = 0,
    Prod = 1
}

/// <summary>
/// Represents a single MarketOps run with dual-mode execution.
/// Mode is stamped everywhere and enforced at runtime.
/// </summary>
public sealed record MarketOpsRun(
    string RunId,
    ExecutionMode Mode,
    DateTimeOffset StartedAt,
    Dictionary<string, object?> Input,
    string? CorrelationId = null)
{
    /// <summary>
    /// Validates that mode is set and valid.
    /// Fail-closed: missing mode → exception.
    /// </summary>
    public void ValidateMode()
    {
        if (Mode != ExecutionMode.DryRun && Mode != ExecutionMode.Prod)
            throw new InvalidOperationException($"Invalid execution mode: {Mode}");
    }

    /// <summary>
    /// Returns true if this is a dry-run execution.
    /// </summary>
    public bool IsDryRun => Mode == ExecutionMode.DryRun;

    /// <summary>
    /// Returns true if this is a production execution.
    /// </summary>
    public bool IsProd => Mode == ExecutionMode.Prod;
}

