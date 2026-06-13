/**
 * Library Canon Foundry — model routing layer.
 *
 * Centralizes provider/model selection so multiple app areas can reuse the same
 * cost/speed/accuracy trade-offs.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ModelTier = "local" | "balanced" | "strong";
export type RoutedProvider = "anthropic" | "ollama" | "blackbox";

export type ProcessingTask =
  | "canon_extraction"
  | "marketing_extraction"
  | "internal_extraction"
  | "trash_detection"
  | "conflict_detection"
  | "public_safety_review"
  | "batch_summary";

export interface RouterConfig {
  ollamaEnabled: boolean;
  blackboxEnabled: boolean;

  ollamaBaseUrl?: string;
  ollamaModel?: string;

  blackboxBaseUrl?: string;
  blackboxLocalModel: string;
  blackboxBalancedModel: string;
  blackboxStrongModel: string;

  anthropicStrongModel: string;

  localConfidenceThreshold: number;
  canonRequiresStrong: boolean;
  publicSafetyRequiresStrong: boolean;
  conflictRequiresStrong: boolean;
}

export type LocalResult = {
  confidenceScore: number;
  appearsToBeCanon?: boolean;
  appearsSensitive?: boolean;
};

export type ModelRoute = {
  provider: RoutedProvider;
  tier: ModelTier;
  modelId: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Default configuration
// ─────────────────────────────────────────────────────────────────────────────

export const defaultRouterConfig: RouterConfig = {
  ollamaEnabled: false,
  blackboxEnabled: true,

  ollamaBaseUrl: process.env.OLLAMA_HOST,
  ollamaModel: process.env.OLLAMA_MODEL ?? "llama3.2",

  blackboxBaseUrl: process.env.BLACKBOX_API_BASE_URL ?? "https://api.blackbox.ai/v1",
  blackboxLocalModel: process.env.BLACKBOX_LOCAL_MODEL ?? "blackbox-fast",
  blackboxBalancedModel: process.env.BLACKBOX_MODEL ?? "blackbox-pro",
  blackboxStrongModel: process.env.BLACKBOX_STRONG_MODEL ?? "blackbox-pro",

  anthropicStrongModel: process.env.ANTHROPIC_STRONG_MODEL ?? "claude-sonnet-4-6",

  localConfidenceThreshold: 0.7,
  canonRequiresStrong: true,
  publicSafetyRequiresStrong: true,
  conflictRequiresStrong: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// Routing logic
// ─────────────────────────────────────────────────────────────────────────────

export function selectModelTier(
  task: ProcessingTask,
  config: RouterConfig = defaultRouterConfig
): ModelTier {
  if (task === "canon_extraction" && config.canonRequiresStrong) return "strong";
  if (task === "public_safety_review" && config.publicSafetyRequiresStrong) return "strong";
  if (task === "conflict_detection" && config.conflictRequiresStrong) return "strong";

  if (task === "trash_detection" || task === "batch_summary") return "local";

  return "balanced";
}

export function shouldEscalate(
  localResult: LocalResult,
  config: RouterConfig = defaultRouterConfig
): boolean {
  if (localResult.confidenceScore < config.localConfidenceThreshold) return true;
  if (localResult.appearsToBeCanon) return true;
  if (localResult.appearsSensitive) return true;
  return false;
}

export function resolveModelId(
  tier: ModelTier,
  config: RouterConfig = defaultRouterConfig
): string {
  if (tier === "strong") return config.blackboxStrongModel;
  if (tier === "balanced") return config.blackboxBalancedModel;
  return config.blackboxLocalModel;
}

export function resolveModelRoute(
  task: ProcessingTask,
  options: { useOllama?: boolean; useBlackbox?: boolean } = {},
  config: RouterConfig = defaultRouterConfig
): ModelRoute {
  const tier = selectModelTier(task, config);

  if (options.useOllama && config.ollamaEnabled) {
    return {
      provider: "ollama",
      tier,
      modelId: config.ollamaModel ?? "llama3.2",
    };
  }

  const blackboxPreferred = options.useBlackbox ?? true;
  if (blackboxPreferred && config.blackboxEnabled) {
    return {
      provider: "blackbox",
      tier,
      modelId: resolveModelId(tier, config),
    };
  }

  return {
    provider: "anthropic",
    tier: "strong",
    modelId: config.anthropicStrongModel,
  };
}
