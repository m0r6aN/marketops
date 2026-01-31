using System;
using System.Collections.Generic;

namespace MarketOps.Delay;

public sealed record DelayPolicy(TimeSpan MinDelay, TimeSpan MaxDelay);

public sealed class DelayController
{
    private readonly IReadOnlyDictionary<string, DelayPolicy> _policies;

    public DelayController(IReadOnlyDictionary<string, DelayPolicy> policies)
    {
        _policies = policies ?? throw new ArgumentNullException(nameof(policies));
    }

    public TimeSpan GetDelayFor(string artifactType)
    {
        if (string.IsNullOrWhiteSpace(artifactType))
            throw new ArgumentException("ArtifactType cannot be empty", nameof(artifactType));

        if (_policies.TryGetValue(artifactType, out var policy))
            return policy.MinDelay;

        return TimeSpan.Zero;
    }
}
