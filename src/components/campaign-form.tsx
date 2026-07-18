"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { createCampaignAction, updateCampaignAction } from "@/app/actions/campaigns";
import { Button } from "@/components/ui/button";
import type { Campaign, CampaignKind, DiscoveryCampaignEditableInput, ManagedCampaignInput } from "@/lib/campaigns";
import {
    campaignLaunchReadinessOptions,
    campaignSensitivityOptions,
    campaignStatusOptions,
} from "@/lib/campaigns/types";
import { initiativeSeed as initiatives } from "@/lib/initiatives/seed";

type CampaignFormProps = {
  mode: "create" | "edit";
  kind: CampaignKind;
  initialValue?: Campaign;
};

type ManagedFormState = {
  id: string;
  initiativeSlug: string;
  name: string;
  status: string;
  goal: string;
  channel: string;
  audience: string;
  primaryCta: string;
  currentFocus: string;
  assetTypes: string;
  claimSensitivity: string;
  launchReadiness: string;
  notes: string;
};

type DiscoveryFormState = {
  name: string;
  initiativeSlug: string;
  targetDescription: string;
  notes: string;
};

function initialManagedState(initialValue?: Campaign): ManagedFormState {
  if (!initialValue) {
    return {
      id: "",
      initiativeSlug: "",
      name: "",
      status: "planning",
      goal: "",
      channel: "",
      audience: "",
      primaryCta: "",
      currentFocus: "",
      assetTypes: "",
      claimSensitivity: "medium",
      launchReadiness: "planning",
      notes: "",
    };
  }

  return {
    id: initialValue.id,
    initiativeSlug: initialValue.initiativeSlug,
    name: initialValue.name,
    status: initialValue.status,
    goal: initialValue.goal,
    channel: initialValue.channel,
    audience: initialValue.audience,
    primaryCta: initialValue.primaryCta,
    currentFocus: initialValue.currentFocus,
    assetTypes: initialValue.assetTypes.join("\n"),
    claimSensitivity: initialValue.claimSensitivity,
    launchReadiness: initialValue.launchReadiness,
    notes: initialValue.notes,
  };
}

function initialDiscoveryState(initialValue?: Campaign): DiscoveryFormState {
  return {
    name: initialValue?.name ?? "",
    initiativeSlug: initialValue?.initiativeSlug ?? "",
    targetDescription: initialValue?.targetDescription ?? "",
    notes: initialValue?.notes ?? "",
  };
}

function toManagedPayload(form: ManagedFormState): ManagedCampaignInput {
  return {
    id: form.id.trim(),
    initiativeSlug: form.initiativeSlug.trim(),
    name: form.name.trim(),
    status: form.status as ManagedCampaignInput["status"],
    goal: form.goal.trim(),
    channel: form.channel.trim(),
    audience: form.audience.trim(),
    primaryCta: form.primaryCta.trim(),
    currentFocus: form.currentFocus.trim(),
    assetTypes: form.assetTypes
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean),
    claimSensitivity: form.claimSensitivity as ManagedCampaignInput["claimSensitivity"],
    launchReadiness: form.launchReadiness as ManagedCampaignInput["launchReadiness"],
    notes: form.notes.trim(),
  };
}

function toDiscoveryPayload(form: DiscoveryFormState): DiscoveryCampaignEditableInput {
  return {
    name: form.name.trim(),
    initiativeSlug: form.initiativeSlug.trim(),
    targetDescription: form.targetDescription.trim(),
    notes: form.notes.trim(),
  };
}

export function CampaignForm({ mode, kind, initialValue }: CampaignFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [managedForm, setManagedForm] = useState<ManagedFormState>(() => initialManagedState(initialValue));
  const [discoveryForm, setDiscoveryForm] = useState<DiscoveryFormState>(() =>
    initialDiscoveryState(initialValue)
  );

  const submitLabel = useMemo(() => {
    if (mode === "create") return "Create campaign";
    return "Save changes";
  }, [mode]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        if (mode === "create") {
          const created = await createCampaignAction(toManagedPayload(managedForm));
          router.push(`/campaigns/${created.id}`);
          return;
        }

        if (!initialValue) {
          throw new Error("Missing initial campaign.");
        }

        if (kind === "managed") {
          await updateCampaignAction(initialValue.id, toManagedPayload(managedForm));
        } else {
          await updateCampaignAction(initialValue.id, toDiscoveryPayload(discoveryForm));
        }

        router.push(`/campaigns/${initialValue.id}`);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unable to save campaign.";
        setError(message);
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {kind === "managed" ? (
        <>
          <section className="grid gap-4 rounded-2xl border border-border/70 bg-card/95 p-5 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium">Campaign ID</span>
              <input
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                value={managedForm.id}
                onChange={(e) => setManagedForm((prev) => ({ ...prev, id: e.target.value }))}
                placeholder="campaign-id"
                required
                disabled={mode === "edit"}
                aria-label="Campaign ID"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">Name</span>
              <input
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                value={managedForm.name}
                onChange={(e) => setManagedForm((prev) => ({ ...prev, name: e.target.value }))}
                required
                aria-label="Campaign name"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">Initiative</span>
              <select
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                value={managedForm.initiativeSlug}
                onChange={(e) =>
                  setManagedForm((prev) => ({ ...prev, initiativeSlug: e.target.value }))
                }
                required
                aria-label="Campaign initiative"
              >
                <option value="" disabled>
                  Select initiative
                </option>
                {initiatives.map((initiative) => (
                  <option key={initiative.slug} value={initiative.slug}>
                    {initiative.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">Status</span>
              <select
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                value={managedForm.status}
                onChange={(e) => setManagedForm((prev) => ({ ...prev, status: e.target.value }))}
                required
                aria-label="Campaign status"
              >
                {campaignStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="grid gap-4 rounded-2xl border border-border/70 bg-card/95 p-5 md:grid-cols-2">
            <label className="space-y-2 text-sm md:col-span-2">
              <span className="font-medium">Goal</span>
              <textarea
                className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2"
                value={managedForm.goal}
                onChange={(e) => setManagedForm((prev) => ({ ...prev, goal: e.target.value }))}
                required
                aria-label="Campaign goal"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">Channel</span>
              <input
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                value={managedForm.channel}
                onChange={(e) => setManagedForm((prev) => ({ ...prev, channel: e.target.value }))}
                required
                aria-label="Campaign channel"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">Audience</span>
              <input
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                value={managedForm.audience}
                onChange={(e) => setManagedForm((prev) => ({ ...prev, audience: e.target.value }))}
                required
                aria-label="Campaign audience"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">Primary CTA</span>
              <input
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                value={managedForm.primaryCta}
                onChange={(e) =>
                  setManagedForm((prev) => ({ ...prev, primaryCta: e.target.value }))
                }
                required
                aria-label="Campaign primary CTA"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">Current focus</span>
              <input
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                value={managedForm.currentFocus}
                onChange={(e) =>
                  setManagedForm((prev) => ({ ...prev, currentFocus: e.target.value }))
                }
                required
                aria-label="Campaign current focus"
              />
            </label>
          </section>

          <section className="grid gap-4 rounded-2xl border border-border/70 bg-card/95 p-5 md:grid-cols-3">
            <label className="space-y-2 text-sm">
              <span className="font-medium">Claim sensitivity</span>
              <select
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                value={managedForm.claimSensitivity}
                onChange={(e) =>
                  setManagedForm((prev) => ({ ...prev, claimSensitivity: e.target.value }))
                }
                required
                aria-label="Campaign claim sensitivity"
              >
                {campaignSensitivityOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">Launch readiness</span>
              <select
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                value={managedForm.launchReadiness}
                onChange={(e) =>
                  setManagedForm((prev) => ({ ...prev, launchReadiness: e.target.value }))
                }
                required
                aria-label="Campaign launch readiness"
              >
                {campaignLaunchReadinessOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm md:col-span-3">
              <span className="font-medium">Asset types (one per line)</span>
              <textarea
                className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2"
                value={managedForm.assetTypes}
                onChange={(e) =>
                  setManagedForm((prev) => ({ ...prev, assetTypes: e.target.value }))
                }
                required
                aria-label="Campaign asset types"
              />
            </label>
          </section>

          <section className="grid gap-4 rounded-2xl border border-border/70 bg-card/95 p-5">
            <label className="space-y-2 text-sm">
              <span className="font-medium">Notes</span>
              <textarea
                className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2"
                value={managedForm.notes}
                onChange={(e) => setManagedForm((prev) => ({ ...prev, notes: e.target.value }))}
                required
                aria-label="Campaign notes"
              />
            </label>
          </section>
        </>
      ) : (
        <>
          <section className="grid gap-4 rounded-2xl border border-border/70 bg-card/95 p-5 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium">Name</span>
              <input
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                value={discoveryForm.name}
                onChange={(e) => setDiscoveryForm((prev) => ({ ...prev, name: e.target.value }))}
                required
                aria-label="Discovery campaign name"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">Initiative</span>
              <select
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                value={discoveryForm.initiativeSlug}
                onChange={(e) =>
                  setDiscoveryForm((prev) => ({ ...prev, initiativeSlug: e.target.value }))
                }
                required
                aria-label="Discovery campaign initiative"
              >
                <option value="" disabled>
                  Select initiative
                </option>
                {initiatives.map((initiative) => (
                  <option key={initiative.slug} value={initiative.slug}>
                    {initiative.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span className="font-medium">Target description</span>
              <textarea
                className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2"
                value={discoveryForm.targetDescription}
                onChange={(e) =>
                  setDiscoveryForm((prev) => ({ ...prev, targetDescription: e.target.value }))
                }
                required
                aria-label="Discovery campaign target description"
              />
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span className="font-medium">Notes</span>
              <textarea
                className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2"
                value={discoveryForm.notes}
                onChange={(e) => setDiscoveryForm((prev) => ({ ...prev, notes: e.target.value }))}
                required
                aria-label="Discovery campaign notes"
              />
            </label>
          </section>

          <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Derived discovery fields remain read-only: status, readiness, sensitivity, provenance,
            candidate records, and drafts are preserved from Customer Finder runs.
          </div>
        </>
      )}

      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending} aria-label={submitLabel}>
          {isPending ? "Saving..." : submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/campaigns")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
