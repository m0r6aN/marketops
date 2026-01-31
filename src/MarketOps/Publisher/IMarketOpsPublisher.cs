using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MarketOps.Contracts;
using MarketOps.Gate;

namespace MarketOps.Publisher;

public interface IMarketOpsPublisher
{
    Task PublishAsync(PublishPacket packet, CancellationToken ct = default);
}

public sealed class AllowlistPublisherGuard
{
    private readonly MarketOpsGateConfig _config;

    public AllowlistPublisherGuard(MarketOpsGateConfig config)
    {
        _config = config ?? throw new ArgumentNullException(nameof(config));
    }

    public void ValidateDestinations(IReadOnlyList<string> destinations)
    {
        if (destinations == null || destinations.Count == 0)
            throw new ArgumentException("Destinations cannot be empty", nameof(destinations));

        var denied = destinations.Where(d => !_config.IsDestinationAllowed(d)).ToList();
        if (denied.Count > 0)
            throw new InvalidOperationException($"Destination not allowed: {string.Join(", ", denied)}");
    }
}
