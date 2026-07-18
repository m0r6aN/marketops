"use client";

import { CheckCircle2, Circle, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { saveCampaignLifecycleAction } from "@/app/actions/campaign-lifecycle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { computeCampaignLifecycleProgress } from "@/lib/campaigns/lifecycle-service";
import {
  campaignExecutionModeOptions,
  campaignExecutionStatusOptions,
  campaignReviewStatusOptions,
  createEmptyCampaignLifecycleInput,
  type CampaignAudienceCandidate,
  type CampaignLifecycleEvent,
  type CampaignLifecycleInput,
  type CampaignLifecycleRecord,
} from "@/lib/campaigns/lifecycle-types";

type CampaignLifecycleWorkspaceProps = {
  campaignId: string;
  lifecycle?: CampaignLifecycleRecord;
  defaults?: Partial<CampaignLifecycleInput>;
  candidates: CampaignAudienceCandidate[];
  events: CampaignLifecycleEvent[];
};

const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2";
const textareaClass = `${inputClass} min-h-28`;

function asInput(
  record?: CampaignLifecycleRecord,
  defaults?: Partial<CampaignLifecycleInput>
): CampaignLifecycleInput {
  if (!record) return { ...createEmptyCampaignLifecycleInput(), ...defaults };
  return {
    brief: record.brief,
    offer: record.offer,
    audienceSegment: record.audienceSegment,
    selectedCandidateIds: record.selectedCandidateIds,
    brandVoiceSummary: record.brandVoiceSummary,
    assetPlan: record.assetPlan,
    channelPlan: record.channelPlan,
    outreachPlan: record.outreachPlan,
    reviewStatus: record.reviewStatus,
    executionMode: record.executionMode,
    executionStatus: record.executionStatus,
    executionEvidence: record.executionEvidence,
    measurementPlan: record.measurementPlan,
    primaryMetric: record.primaryMetric,
    targetValue: record.targetValue,
    actualOutcome: record.actualOutcome,
    optimizationNotes: record.optimizationNotes,
    nextIteration: record.nextIteration,
  };
}

export function CampaignLifecycleWorkspace({
  campaignId,
  lifecycle,
  defaults,
  candidates,
  events,
}: CampaignLifecycleWorkspaceProps) {
  const router = useRouter();
  const [form, setForm] = useState<CampaignLifecycleInput>(() => asInput(lifecycle, defaults));
  const [assetPlanText, setAssetPlanText] = useState(() => form.assetPlan.join("\n"));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const progress = useMemo(
    () => computeCampaignLifecycleProgress({ ...form, assetPlan: toLines(assetPlanText) }),
    [form, assetPlanText]
  );
  const unavailableCandidateIds = useMemo(() => {
    const availableIds = new Set(candidates.map((candidate) => candidate.id));
    return form.selectedCandidateIds.filter((candidateId) => !availableIds.has(candidateId));
  }, [candidates, form.selectedCandidateIds]);

  const update = <K extends keyof CampaignLifecycleInput>(
    key: K,
    value: CampaignLifecycleInput[K]
  ) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleCandidate = (candidateId: string) => {
    const selected = form.selectedCandidateIds.includes(candidateId);
    update(
      "selectedCandidateIds",
      selected
        ? form.selectedCandidateIds.filter((id) => id !== candidateId)
        : [...form.selectedCandidateIds, candidateId]
    );
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaved(false);

    startTransition(async () => {
      try {
        const result = await saveCampaignLifecycleAction(campaignId, {
          ...form,
          assetPlan: toLines(assetPlanText),
        });
        setForm(asInput(result));
        setAssetPlanText(result.assetPlan.join("\n"));
        setSaved(true);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to save the campaign lifecycle.");
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="gap-3 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <CardTitle className="text-xl font-semibold">Full campaign lifecycle</CardTitle>
              <CardDescription className="max-w-3xl leading-6">
                Plan, review, record execution, measure outcomes, and preserve the next iteration in one
                operator-owned workspace.
              </CardDescription>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-right">
              <p className="text-2xl font-semibold">{progress.percent}%</p>
              <p className="text-xs text-muted-foreground">
                {progress.completed} of {progress.total} phases complete
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 px-6 pb-6 md:grid-cols-2 xl:grid-cols-4">
          {progress.phases.map((phase) => (
            <div key={phase.id} className="flex gap-3 rounded-xl border border-border/70 p-3">
              {phase.complete ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
              ) : (
                <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <div className="space-y-1">
                <p className="text-sm font-medium">{phase.label}</p>
                <p className="text-xs leading-5 text-muted-foreground">{phase.explanation}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <form onSubmit={onSubmit} className="space-y-6">
        <LifecycleSection
          title="1. Brief and offer"
          description="Define the campaign objective and the offer the audience should understand."
        >
          <TextAreaField
            label="Campaign brief"
            value={form.brief}
            onChange={(value) => update("brief", value)}
            placeholder="Objective, audience problem, desired change, and campaign boundaries."
          />
          <TextAreaField
            label="Offer"
            value={form.offer}
            onChange={(value) => update("offer", value)}
            placeholder="What Keon Systems or BioStack is offering and why it is relevant now."
          />
        </LifecycleSection>

        <LifecycleSection
          title="2. Audience"
          description="Keep the segment explicit and attach only verified candidates from this initiative."
        >
          <TextAreaField
            label="Audience segment"
            value={form.audienceSegment}
            onChange={(value) => update("audienceSegment", value)}
            placeholder="Decision-makers, users, context, qualification signals, and exclusions."
          />
          <div className="space-y-3 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Verified Customer Finder candidates</p>
              <Badge variant="outline">{form.selectedCandidateIds.length} selected</Badge>
            </div>
            {candidates.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                No verified candidates are available for this initiative. The audience plan can still be
                saved, then linked after a Customer Finder run.
              </p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {candidates.map((candidate) => (
                  <label
                    key={candidate.id}
                    className="flex cursor-pointer gap-3 rounded-xl border border-border/70 p-4"
                  >
                    <input
                      type="checkbox"
                      checked={form.selectedCandidateIds.includes(candidate.id)}
                      onChange={() => toggleCandidate(candidate.id)}
                      className="mt-1"
                    />
                    <span className="space-y-1">
                      <span className="block text-sm font-medium">
                        {candidate.displayName}
                        {candidate.organizationName ? ` — ${candidate.organizationName}` : ""}
                      </span>
                      <span className="block text-xs leading-5 text-muted-foreground">
                        {candidate.verifiedEvidence}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {candidate.discoveryCampaignName} · {candidate.confidenceLabel} confidence
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            {unavailableCandidateIds.length > 0 ? (
              <div className="rounded-lg border border-amber-400/50 bg-amber-50/40 p-4 text-sm dark:bg-amber-950/10">
                <p className="font-medium">Unavailable candidate references</p>
                <p className="mt-1 leading-6 text-muted-foreground">
                  These candidates were removed or expired from Customer Finder. Remove the stale
                  references before saving this lifecycle again.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {unavailableCandidateIds.map((candidateId) => (
                    <Button
                      key={candidateId}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => toggleCandidate(candidateId)}
                    >
                      Remove {candidateId}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </LifecycleSection>

        <LifecycleSection
          title="3. Assets, voice, and distribution"
          description="Record the working voice constraints, required assets, and channel plan."
        >
          <TextAreaField
            label="Working brand voice"
            value={form.brandVoiceSummary}
            onChange={(value) => update("brandVoiceSummary", value)}
            placeholder="Interim voice, claim, tone, and terminology constraints. Capability 3 will make this reusable."
          />
          <TextAreaField
            label="Asset plan (one per line)"
            value={assetPlanText}
            onChange={(value) => {
              setSaved(false);
              setAssetPlanText(value);
            }}
            placeholder={"Landing page\nFounder post\nEmail sequence"}
          />
          <TextAreaField
            label="Channel plan"
            value={form.channelPlan}
            onChange={(value) => update("channelPlan", value)}
            placeholder="Owned, earned, direct, and partner channels; sequence and ownership."
          />
          <TextAreaField
            label="Outreach plan"
            value={form.outreachPlan}
            onChange={(value) => update("outreachPlan", value)}
            placeholder="Who prepares, reviews, and manually delivers each outreach step."
          />
        </LifecycleSection>

        <LifecycleSection
          title="4. Review and execution"
          description="Review state and execution state are separate. Nothing here sends or publishes externally."
        >
          <SelectField
            label="Review status"
            value={form.reviewStatus}
            options={campaignReviewStatusOptions}
            onChange={(value) => update("reviewStatus", value as CampaignLifecycleInput["reviewStatus"])}
          />
          <SelectField
            label="Execution mode"
            value={form.executionMode}
            options={campaignExecutionModeOptions}
            onChange={(value) => {
              const mode = value as CampaignLifecycleInput["executionMode"];
              setForm((current) => ({
                ...current,
                executionMode: mode,
                executionStatus: mode === "provider-ready" ? "not-started" : current.executionStatus,
              }));
              setSaved(false);
            }}
          />
          <SelectField
            label="Execution status"
            value={form.executionStatus}
            options={campaignExecutionStatusOptions}
            disabled={form.executionMode === "provider-ready"}
            onChange={(value) =>
              update("executionStatus", value as CampaignLifecycleInput["executionStatus"])
            }
          />
          <div className="rounded-xl border border-amber-400/50 bg-amber-50/40 p-4 text-sm leading-6 dark:bg-amber-950/10">
            <div className="flex items-center gap-2 font-medium">
              <ShieldAlert className="size-4" aria-hidden="true" />
              Execution boundary
            </div>
            <p className="mt-2 text-muted-foreground">
              Manual status is an operator record. Provider-ready means the plan can be adapted later;
              no provider is connected and execution cannot be claimed.
            </p>
          </div>
          <div className="md:col-span-2">
            <TextAreaField
              label="Execution evidence note"
              value={form.executionEvidence}
              onChange={(value) => update("executionEvidence", value)}
              placeholder="Operator, date, channel, external reference, observed failure, or other reviewable evidence."
            />
          </div>
        </LifecycleSection>

        <LifecycleSection
          title="5. Measurement and optimization"
          description="Define success before execution, then record observed outcomes and the next iteration."
        >
          <TextAreaField
            label="Measurement plan"
            value={form.measurementPlan}
            onChange={(value) => update("measurementPlan", value)}
            placeholder="Instrumentation, attribution window, reporting cadence, and data owner."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Primary metric"
              value={form.primaryMetric}
              onChange={(value) => update("primaryMetric", value)}
              placeholder="Qualified access requests"
            />
            <TextField
              label="Target value"
              value={form.targetValue}
              onChange={(value) => update("targetValue", value)}
              placeholder="10 in 30 days"
            />
          </div>
          <TextAreaField
            label="Actual outcome"
            value={form.actualOutcome}
            onChange={(value) => update("actualOutcome", value)}
            placeholder="Observed result, measurement date, and known attribution limitations."
          />
          <TextAreaField
            label="Optimization notes"
            value={form.optimizationNotes}
            onChange={(value) => update("optimizationNotes", value)}
            placeholder="What worked, what did not, and the evidence behind the conclusion."
          />
          <div className="md:col-span-2">
            <TextAreaField
              label="Next iteration"
              value={form.nextIteration}
              onChange={(value) => update("nextIteration", value)}
              placeholder="One concrete change to audience, offer, content, channel, or measurement."
            />
          </div>
        </LifecycleSection>

        {error ? (
          <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-50/40 px-4 py-3 text-sm dark:bg-emerald-950/10">
            Campaign lifecycle saved. No external action was performed.
          </p>
        ) : null}

        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving lifecycle..." : "Save campaign lifecycle"}
        </Button>
      </form>

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Operator event trail</CardTitle>
          <CardDescription>
            Reviewable plan and manual execution-status changes recorded by MarketOps.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lifecycle events recorded yet.</p>
          ) : (
            events.map((event) => (
              <div key={event.id} className="rounded-xl border border-border/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{event.summary}</p>
                  <time className="text-xs text-muted-foreground" dateTime={event.recordedAt}>
                    {formatEventTime(event.recordedAt)}
                  </time>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{event.eventType}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function toLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatEventTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value)) + " UTC";
}

function LifecycleSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">{children}</CardContent>
    </Card>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="space-y-2 text-sm">
      <span className="font-medium">{label}</span>
      <input
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="space-y-2 text-sm">
      <span className="font-medium">{label}</span>
      <textarea
        className={textareaClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="space-y-2 text-sm">
      <span className="font-medium">{label}</span>
      <select
        className={inputClass}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
