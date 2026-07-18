"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
    createInitiativeAction,
    updateInitiativeAction,
} from "@/app/actions/initiatives";
import { Button } from "@/components/ui/button";
import type {
    Initiative,
    InitiativeInput,
    InitiativeStageKey,
    InitiativeStatusKey,
} from "@/lib/initiatives/types";

type InitiativeFormProps = {
  mode: "create" | "edit";
  initialValue?: Initiative;
};

type FormState = {
  slug: string;
  name: string;
  category: string;
  stageKey: InitiativeStageKey;
  stageLabel: string;
  statusKey: InitiativeStatusKey;
  statusLabel: string;
  oneLiner: string;
  primaryAudiences: string;
  primaryCta: string;
  currentMarketingFocus: string;
  allowedClaims: string;
  bannedClaims: string;
  needsProofClaims: string;
  claimPosture: string;
  narrative: string;
  toneNotes: string;
  publicUrl: string;
  repoUrl: string;
  needsPositioningReview: boolean;
  isActive: boolean;
};

const STAGE_OPTIONS: Array<{ key: InitiativeStageKey; label: string }> = [
  { key: "public-proof", label: "Public proof" },
  { key: "alpha", label: "Alpha" },
  { key: "concept", label: "Concept" },
];

const STATUS_OPTIONS: Array<{ key: InitiativeStatusKey; label: string }> = [
  { key: "access-building", label: "Access-building" },
  { key: "conversion-polish", label: "Conversion polish" },
  { key: "early-build", label: "Early build" },
];

function listToMultiline(values: string[]) {
  return values.join("\n");
}

function parseMultiline(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function initialFormState(initialValue?: Initiative): FormState {
  if (!initialValue) {
    return {
      slug: "",
      name: "",
      category: "",
      stageKey: "concept",
      stageLabel: "Concept",
      statusKey: "early-build",
      statusLabel: "Early build",
      oneLiner: "",
      primaryAudiences: "",
      primaryCta: "",
      currentMarketingFocus: "",
      allowedClaims: "",
      bannedClaims: "",
      needsProofClaims: "",
      claimPosture: "",
      narrative: "",
      toneNotes: "",
      publicUrl: "",
      repoUrl: "",
      needsPositioningReview: false,
      isActive: true,
    };
  }

  return {
    slug: initialValue.slug,
    name: initialValue.name,
    category: initialValue.category,
    stageKey: initialValue.stage.key,
    stageLabel: initialValue.stage.label,
    statusKey: initialValue.status.key,
    statusLabel: initialValue.status.label,
    oneLiner: initialValue.oneLiner,
    primaryAudiences: listToMultiline(initialValue.primaryAudiences.map((a) => a.label)),
    primaryCta: initialValue.primaryCta,
    currentMarketingFocus: initialValue.currentMarketingFocus,
    allowedClaims: listToMultiline(initialValue.allowedClaims.map((claim) => claim.text)),
    bannedClaims: listToMultiline(initialValue.bannedClaims.map((claim) => claim.text)),
    needsProofClaims: listToMultiline(initialValue.needsProofClaims.map((claim) => claim.text)),
    claimPosture: initialValue.claimPosture,
    narrative: initialValue.narrative,
    toneNotes: initialValue.toneNotes,
    publicUrl: initialValue.publicUrl ?? "",
    repoUrl: initialValue.repoUrl ?? "",
    needsPositioningReview: initialValue.needsPositioningReview,
    isActive: initialValue.isActive,
  };
}

function toInitiativeInput(form: FormState): InitiativeInput {
  return {
    slug: form.slug.trim(),
    name: form.name.trim(),
    category: form.category.trim(),
    stage: { key: form.stageKey, label: form.stageLabel.trim() },
    status: { key: form.statusKey, label: form.statusLabel.trim() },
    oneLiner: form.oneLiner.trim(),
    primaryAudiences: parseMultiline(form.primaryAudiences).map((label) => ({ label })),
    primaryCta: form.primaryCta.trim(),
    currentMarketingFocus: form.currentMarketingFocus.trim(),
    allowedClaims: parseMultiline(form.allowedClaims).map((text) => ({ text })),
    bannedClaims: parseMultiline(form.bannedClaims).map((text) => ({ text })),
    needsProofClaims: parseMultiline(form.needsProofClaims).map((text) => ({ text })),
    claimPosture: form.claimPosture.trim(),
    narrative: form.narrative.trim(),
    toneNotes: form.toneNotes.trim(),
    publicUrl: form.publicUrl.trim() || undefined,
    repoUrl: form.repoUrl.trim() || undefined,
    needsPositioningReview: form.needsPositioningReview,
    isActive: form.isActive,
  };
}

export function InitiativeForm({ mode, initialValue }: InitiativeFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => initialFormState(initialValue));

  const submitLabel = useMemo(
    () => (mode === "create" ? "Create initiative" : "Save changes"),
    [mode]
  );

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const payload = toInitiativeInput(form);

    if (!payload.slug || !payload.name) {
      setError("Slug and name are required.");
      return;
    }

    startTransition(async () => {
      try {
        if (mode === "create") {
          await createInitiativeAction(payload);
          router.push(`/initiatives/${payload.slug}`);
        } else {
          if (!initialValue) {
            throw new Error("Missing initial initiative.");
          }
          await updateInitiativeAction(initialValue.slug, payload);
          router.push(`/initiatives/${payload.slug}`);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unable to save initiative.";
        setError(message);
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="grid gap-4 rounded-2xl border border-border/70 bg-card/95 p-5 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-medium">Slug</span>
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
            value={form.slug}
            onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
            placeholder="initiative-slug"
            required
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Name</span>
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Initiative name"
            required
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Category</span>
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
            value={form.category}
            onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
            required
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">One-liner</span>
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
            value={form.oneLiner}
            onChange={(e) => setForm((prev) => ({ ...prev, oneLiner: e.target.value }))}
            required
          />
        </label>
      </section>

      <section className="grid gap-4 rounded-2xl border border-border/70 bg-card/95 p-5 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-medium">Stage key</span>
          <select
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
            value={form.stageKey}
            onChange={(e) => {
              const key = e.target.value as InitiativeStageKey;
              const option = STAGE_OPTIONS.find((item) => item.key === key)!;
              setForm((prev) => ({ ...prev, stageKey: option.key, stageLabel: option.label }));
            }}
          >
            {STAGE_OPTIONS.map((stage) => (
              <option key={stage.key} value={stage.key}>
                {stage.key}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Stage label</span>
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
            value={form.stageLabel}
            onChange={(e) => setForm((prev) => ({ ...prev, stageLabel: e.target.value }))}
            required
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Status key</span>
          <select
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
            value={form.statusKey}
            onChange={(e) => {
              const key = e.target.value as InitiativeStatusKey;
              const option = STATUS_OPTIONS.find((item) => item.key === key)!;
              setForm((prev) => ({ ...prev, statusKey: option.key, statusLabel: option.label }));
            }}
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status.key} value={status.key}>
                {status.key}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Status label</span>
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
            value={form.statusLabel}
            onChange={(e) => setForm((prev) => ({ ...prev, statusLabel: e.target.value }))}
            required
          />
        </label>
      </section>

      <section className="grid gap-4 rounded-2xl border border-border/70 bg-card/95 p-5">
        <label className="space-y-2 text-sm">
          <span className="font-medium">Primary audiences (one per line)</span>
          <textarea
            className="min-h-28 w-full rounded-lg border border-border bg-background px-3 py-2"
            value={form.primaryAudiences}
            onChange={(e) => setForm((prev) => ({ ...prev, primaryAudiences: e.target.value }))}
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Primary CTA</span>
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
            value={form.primaryCta}
            onChange={(e) => setForm((prev) => ({ ...prev, primaryCta: e.target.value }))}
            required
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Current marketing focus</span>
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
            value={form.currentMarketingFocus}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, currentMarketingFocus: e.target.value }))
            }
            required
          />
        </label>
      </section>

      <section className="grid gap-4 rounded-2xl border border-border/70 bg-card/95 p-5">
        <label className="space-y-2 text-sm">
          <span className="font-medium">Allowed claims (one per line)</span>
          <textarea
            className="min-h-28 w-full rounded-lg border border-border bg-background px-3 py-2"
            value={form.allowedClaims}
            onChange={(e) => setForm((prev) => ({ ...prev, allowedClaims: e.target.value }))}
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Banned claims (one per line)</span>
          <textarea
            className="min-h-28 w-full rounded-lg border border-border bg-background px-3 py-2"
            value={form.bannedClaims}
            onChange={(e) => setForm((prev) => ({ ...prev, bannedClaims: e.target.value }))}
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Needs-proof claims (one per line)</span>
          <textarea
            className="min-h-28 w-full rounded-lg border border-border bg-background px-3 py-2"
            value={form.needsProofClaims}
            onChange={(e) => setForm((prev) => ({ ...prev, needsProofClaims: e.target.value }))}
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Claim posture</span>
          <textarea
            className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2"
            value={form.claimPosture}
            onChange={(e) => setForm((prev) => ({ ...prev, claimPosture: e.target.value }))}
            required
          />
        </label>
      </section>

      <section className="grid gap-4 rounded-2xl border border-border/70 bg-card/95 p-5">
        <label className="space-y-2 text-sm">
          <span className="font-medium">Narrative</span>
          <textarea
            className="min-h-32 w-full rounded-lg border border-border bg-background px-3 py-2"
            value={form.narrative}
            onChange={(e) => setForm((prev) => ({ ...prev, narrative: e.target.value }))}
            required
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Tone notes</span>
          <textarea
            className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2"
            value={form.toneNotes}
            onChange={(e) => setForm((prev) => ({ ...prev, toneNotes: e.target.value }))}
            required
          />
        </label>
      </section>

      <section className="grid gap-4 rounded-2xl border border-border/70 bg-card/95 p-5 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-medium">Public URL</span>
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
            value={form.publicUrl}
            onChange={(e) => setForm((prev) => ({ ...prev, publicUrl: e.target.value }))}
            placeholder="https://..."
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Repo URL</span>
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
            value={form.repoUrl}
            onChange={(e) => setForm((prev) => ({ ...prev, repoUrl: e.target.value }))}
            placeholder="https://..."
          />
        </label>

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.needsPositioningReview}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, needsPositioningReview: e.target.checked }))
            }
          />
          Needs positioning review
        </label>

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
          />
          Active
        </label>
      </section>

      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/initiatives")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
