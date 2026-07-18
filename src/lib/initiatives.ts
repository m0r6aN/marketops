import { getPortfolioMetrics as getPortfolioMetricsValue } from "@/lib/initiatives/repository";

export type {
  AudienceSegment,
  ClaimRule,
  Initiative,
  InitiativeInput,
  InitiativeStage,
  InitiativeStageKey,
  InitiativeStatus,
  InitiativeStatusKey,
  PortfolioMetrics
} from "@/lib/initiatives/types";

export {
  archiveInitiative,
  createInitiative,
  getInitiativeBySlug,
  getInitiativeBySlugAnyStatus,
  getPortfolioMetrics,
  listInitiatives,
  updateInitiative
} from "@/lib/initiatives/repository";
export { initiativeSeed as initiatives } from "@/lib/initiatives/seed";

export const portfolioMetricPlaceholders = {
  campaignsInMotion: 0 as const,
};

export const portfolioMetrics = getPortfolioMetricsValue();
