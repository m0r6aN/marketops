using MarketOps.Contracts;

namespace MarketOps.Curator;

public interface IMarketOpsCurator
{
    PublishPacket Curate(PublishPacket packet);
}
