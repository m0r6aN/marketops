export const automationLevels = [
  "manual-only",
  "human-approved",
  "governed-automation",
  "blocked",
] as const;

export type AutomationLevel = (typeof automationLevels)[number];

export type AutomationLevelDefinition = {
  label: string;
  description: string;
};

export const automationLevelDefinitions = {
  "manual-only": {
    label: "Manual only",
    description: "Humans perform the work directly. No agent execution is authorized.",
  },
  "human-approved": {
    label: "Human approved",
    description: "Agents may assist only after a human approval checkpoint is recorded.",
  },
  "governed-automation": {
    label: "Governed automation",
    description: "Execution may proceed under an external governance boundary once approved for that lane.",
  },
  blocked: {
    label: "Blocked",
    description: "No execution is allowed until policy or review constraints are cleared.",
  },
} as const satisfies Record<AutomationLevel, AutomationLevelDefinition>;
