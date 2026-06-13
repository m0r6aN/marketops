"use client";
import type { ProcessingMode } from "@/lib/library/types";

const MODES: { id: ProcessingMode; label: string; description: string }[] = [
  {
    id: "canon",
    label: "Public Canon",
    description: "Extract official, durable public truth",
  },
  {
    id: "marketing",
    label: "Marketing Gold",
    description: "Find phrases, hooks, and copy candidates",
  },
  {
    id: "internal",
    label: "Internal Knowledge",
    description: "Preserve private strategy and technical notes",
  },
  {
    id: "trash",
    label: "Trash Detection",
    description: "Identify useless or noisy documents",
  },
];

type ModeSelectorProps = {
  selected: ProcessingMode[];
  onChange: (modes: ProcessingMode[]) => void;
};

export function ModeSelector({ selected, onChange }: ModeSelectorProps) {
  function toggle(mode: ProcessingMode) {
    if (selected.includes(mode)) {
      onChange(selected.filter((m) => m !== mode));
    } else {
      onChange([...selected, mode]);
    }
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {MODES.map((mode) => {
        const checked = selected.includes(mode.id);
        const isScreeningMode = mode.id === "trash";
        const purposeLabel = isScreeningMode ? "Screening" : "Extraction";
        const checkedCardClass =
          isScreeningMode
            ? "border-amber-300 bg-amber-50 text-amber-950 shadow-sm dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-50"
            : "border-teal-300 bg-teal-50 text-teal-950 shadow-sm dark:border-teal-700 dark:bg-teal-950/30 dark:text-teal-50";
        const checkedIndicatorClass =
          isScreeningMode
            ? "border-amber-600 bg-amber-600 text-white dark:border-amber-500 dark:bg-amber-500"
            : "border-teal-600 bg-teal-600 text-white dark:border-teal-500 dark:bg-teal-500";
        const checkedDescriptionClass =
          isScreeningMode ? "text-amber-700 dark:text-amber-200" : "text-teal-700 dark:text-teal-200";
        const purposeBadgeClass = checked
          ? isScreeningMode
            ? "border-amber-200/80 bg-amber-100/80 text-amber-800 dark:border-amber-700/70 dark:bg-amber-900/40 dark:text-amber-100"
            : "border-teal-200/80 bg-teal-100/80 text-teal-800 dark:border-teal-700/70 dark:bg-teal-900/40 dark:text-teal-100"
          : isScreeningMode
            ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
            : "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200";

        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => toggle(mode.id)}
            aria-pressed={checked}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
              checked ? checkedCardClass : "border-border/60 hover:border-border hover:bg-muted/40"
            }`}
          >
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                checked ? checkedIndicatorClass : "border-border"
              }`}
            >
              {checked && (
                <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 text-white">
                  <path d="M1.5 5l2.5 2.5 4.5-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={`mb-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${purposeBadgeClass}`}
              >
                {purposeLabel}
              </span>
              <span className="block font-medium">{mode.label}</span>
              <span
                className={`block text-xs ${
                  checked ? checkedDescriptionClass : "text-muted-foreground"
                }`}
              >
                {mode.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
