export type ReadinessLevel = "required" | "recommended" | "informational";

export type ReadinessCategory =
  | "foundation"
  | "trust"
  | "measurement"
  | "operations"
  | "distribution";

export type ReadinessStatus = "blocked" | "needs_review" | "ready";

export type ChecklistDefinition = {
  id: string;
  label: string;
  description: string;
  level: ReadinessLevel;
  category: ReadinessCategory;
  active: boolean;
  displayOrder: number;
  initiativeSlugs?: string[];
};

export type ChecklistStateRecord = {
  initiativeSlug: string;
  definitionId: string;
  complete: boolean;
  updatedAt: string;
};

export type ReadinessChecklistItem = ChecklistDefinition & {
  complete: boolean;
};

export type ReadinessCategoryGroup = {
  category: ReadinessCategory;
  label: string;
  items: ReadinessChecklistItem[];
};

export type ReadinessCounts = {
  total: number;
  completed: number;
  requiredIncomplete: number;
  recommendedIncomplete: number;
};

export type InitiativeReadinessView = {
  initiativeSlug: string;
  status: ReadinessStatus;
  progressPercent: number;
  counts: ReadinessCounts;
  groups: ReadinessCategoryGroup[];
};
