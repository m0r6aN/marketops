import { readinessCategoryLabels } from "@/lib/readiness/definitions";
import {
  getChecklistDefinitionsForInitiative,
  getChecklistStateForInitiative,
} from "@/lib/readiness/repository";
import type {
  InitiativeReadinessView,
  ReadinessCategory,
  ReadinessChecklistItem,
  ReadinessStatus,
} from "@/lib/readiness/types";

export function getInitiativeReadinessView(
  initiativeSlug: string
): InitiativeReadinessView {
  const definitions = getChecklistDefinitionsForInitiative(initiativeSlug);
  const stateRows = getChecklistStateForInitiative(initiativeSlug);
  const stateMap = new Map(
    stateRows.map((row) => [row.definitionId, row.complete] as const)
  );

  const items: ReadinessChecklistItem[] = definitions.map((definition) => ({
    ...definition,
    complete: stateMap.get(definition.id) ?? false,
  }));

  const total = items.length;
  const completed = items.filter((item) => item.complete).length;
  const requiredIncomplete = items.filter(
    (item) => item.level === "required" && !item.complete
  ).length;
  const recommendedIncomplete = items.filter(
    (item) => item.level === "recommended" && !item.complete
  ).length;

  const status: ReadinessStatus =
    requiredIncomplete > 0
      ? "blocked"
      : recommendedIncomplete > 0
        ? "needs_review"
        : "ready";

  const grouped = items.reduce<Map<ReadinessCategory, ReadinessChecklistItem[]>>(
    (acc, item) => {
      const current = acc.get(item.category) ?? [];
      current.push(item);
      acc.set(item.category, current);
      return acc;
    },
    new Map()
  );

  const groups = Array.from(grouped.entries()).map(([category, groupItems]) => ({
    category,
    label: readinessCategoryLabels[category],
    items: groupItems,
  }));

  return {
    initiativeSlug,
    status,
    progressPercent: total === 0 ? 0 : Math.round((completed / total) * 100),
    counts: {
      total,
      completed,
      requiredIncomplete,
      recommendedIncomplete,
    },
    groups,
  };
}
