"use client";

import type { ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, Search, Wand2, XCircle } from "lucide-react";

import {
  createDiscoveryCampaign,
  getDiscoverySourceChecklist,
  suggestTargetCustomerDescription,
} from "@/app/actions/customer-finder";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { initiatives } from "@/lib/initiatives";
import type { DiscoverySourceId, DiscoverySourceProposal } from "@/lib/customer-finder/types";
import { cn } from "@/lib/utils";

type SuggestionState = {
  suggestedDescription: string;
  rationale: string[];
  suggestedCampaignName: string;
};

const channelSummary = ["Email drafts", "LinkedIn drafts", "X drafts", "CRM / CSV handoff"];

export function CustomerFinderWizard() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [initiativeSlug, setInitiativeSlug] = useState("");
  const [prompt, setPrompt] = useState("");
  const [suggestion, setSuggestion] = useState<SuggestionState | null>(null);
  const [targetDescription, setTargetDescription] = useState("");
  const [sourceChecklist, setSourceChecklist] = useState<DiscoverySourceProposal[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<DiscoverySourceId[]>([]);
  const [sourceInputs, setSourceInputs] = useState<Partial<Record<DiscoverySourceId, string>>>({});
  const [submissionKey, setSubmissionKey] = useState(() => crypto.randomUUID());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentInitiative = useMemo(
    () => initiatives.find((initiative) => initiative.slug === initiativeSlug),
    [initiativeSlug]
  );

  const canSuggest = prompt.trim().length > 0;
  const canBuildSources = targetDescription.trim().length > 0;
  const canCreateCampaign = selectedSourceIds.length > 0 && targetDescription.trim().length > 0;

  function toggleSource(sourceId: DiscoverySourceId) {
    setSelectedSourceIds((current) =>
      current.includes(sourceId)
        ? current.filter((value) => value !== sourceId)
        : [...current, sourceId]
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="space-y-2 p-6">
          <CardTitle className="text-xl font-semibold tracking-tight">Customer finder copilot</CardTitle>
          <CardDescription className="max-w-3xl leading-6">
            This flow creates planning-only discovery campaigns. It records provenance, keeps unsupported
            sources honest, and generates review-required drafts without any outbound send path.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 px-6 pb-6">
          <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-foreground">Initiative context</span>
              <select
                value={initiativeSlug}
                onChange={(event) => setInitiativeSlug(event.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Workspace only</option>
                {initiatives.map((initiative) => (
                  <option key={initiative.slug} value={initiative.slug}>
                    {initiative.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-foreground">Prospect request</span>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={5}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm leading-6"
                placeholder="Example: Startups and solo entrepreneurs building AI-powered workflows for their clients."
              />
            </label>
          </div>

          {currentInitiative ? (
            <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm leading-6 text-muted-foreground">
              <p className="font-medium text-foreground">Available campaign context</p>
              <p className="mt-1">{currentInitiative.oneLiner}</p>
              <p className="mt-1">
                Primary audiences: {currentInitiative.primaryAudiences.map((audience) => audience.label).join(", ")}
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button
              disabled={!canSuggest || isPending}
              onClick={() => {
                setErrorMessage(null);
                setStatusMessage(null);
                startTransition(async () => {
                  try {
                    const result = await suggestTargetCustomerDescription({
                      prompt,
                      initiativeSlug: initiativeSlug || undefined,
                    });
                    setSuggestion(result);
                    setTargetDescription(result.suggestedDescription);
                    setSourceChecklist([]);
                    setSelectedSourceIds([]);
                    setStatusMessage("Target-customer suggestion ready for review.");
                  } catch (error) {
                    setErrorMessage(error instanceof Error ? error.message : "Suggestion failed.");
                  }
                });
              }}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
              Suggest target customer
            </Button>
            <Button
              variant="outline"
              disabled={!suggestion}
              onClick={() => {
                setSuggestion(null);
                setTargetDescription("");
                setSourceChecklist([]);
                setSelectedSourceIds([]);
                setSourceInputs({});
                setSubmissionKey(crypto.randomUUID());
                setStatusMessage("Workflow cancelled. No campaign was created.");
              }}
            >
              Cancel workflow
            </Button>
          </div>
        </CardContent>
      </Card>

      {suggestion ? (
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader className="space-y-2 p-6">
            <CardTitle className="text-lg font-semibold">Editable target-customer description</CardTitle>
            <CardDescription>
              Accept the suggestion as written, edit it before continuing, or cancel above.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-6 pb-6">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-foreground">Target description</span>
              <textarea
                value={targetDescription}
                onChange={(event) => setTargetDescription(event.target.value)}
                rows={3}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm leading-6"
              />
            </label>
            <div className="grid gap-2 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm leading-6 text-muted-foreground">
              <p className="font-medium text-foreground">Why this was suggested</p>
              {suggestion.rationale.map((item) => (
                <p key={item}>• {item}</p>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={!canBuildSources || isPending}
                onClick={() => {
                  setErrorMessage(null);
                  startTransition(async () => {
                    try {
                      const checklist = await getDiscoverySourceChecklist({
                        targetDescription,
                      });
                      setSourceChecklist(checklist);
                      setSelectedSourceIds(
                        checklist
                          .filter((source) => source.selectedByDefault)
                          .map((source) => source.id)
                      );
                      setSubmissionKey(crypto.randomUUID());
                      setStatusMessage("Source checklist ready. Supported sources are pre-selected.");
                    } catch (error) {
                      setErrorMessage(error instanceof Error ? error.message : "Checklist failed.");
                    }
                  });
                }}
              >
                {isPending ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                Continue to sources
              </Button>
              <div className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground">
                Draft channels: {channelSummary.join(" · ")}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {sourceChecklist.length > 0 ? (
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader className="space-y-2 p-6">
            <CardTitle className="text-lg font-semibold">Relevant source checklist</CardTitle>
            <CardDescription>
              Supported sources are selected by default. Unsupported sources stay visible but are not
              represented as searchable in this build.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-6 pb-6">
            <div className="grid gap-4">
              {sourceChecklist.map((source) => {
                const isSelected = selectedSourceIds.includes(source.id);
                const isUnavailable = source.supportLevel === "unsupported";
                return (
                  <div
                    key={source.id}
                    className={cn(
                      "rounded-2xl border px-4 py-4",
                      isSelected ? "border-foreground/15 bg-muted/20" : "border-border/70 bg-background"
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <label className="flex items-start gap-3 text-sm leading-6">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isUnavailable}
                          onChange={() => toggleSource(source.id)}
                          className="mt-1 size-4 rounded border-border"
                        />
                        <span>
                          <span className="block font-medium text-foreground">{source.label}</span>
                          <span className="block text-muted-foreground">{source.reason}</span>
                        </span>
                      </label>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span
                          className={cn(
                            "rounded-full border px-2.5 py-1",
                            source.supportLevel === "supported"
                              ? "border-emerald-500/40 bg-emerald-50/40 text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200"
                              : source.supportLevel === "conditional"
                                ? "border-amber-400/50 bg-amber-50/40 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200"
                                : "border-border/70 bg-muted/40 text-muted-foreground"
                          )}
                        >
                          {source.supportLevel}
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{source.explanation}</p>
                    {source.availabilityNote ? (
                      <div className="mt-3 rounded-xl border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                        {source.availabilityNote}
                      </div>
                    ) : null}
                    {source.requiresSeedInput ? (
                      <label className="mt-3 block space-y-2 text-sm">
                        <span className="font-medium text-foreground">{source.inputLabel}</span>
                        <textarea
                          value={sourceInputs[source.id] ?? ""}
                          onChange={(event) =>
                            setSourceInputs((current) => ({
                              ...current,
                              [source.id]: event.target.value,
                            }))
                          }
                          rows={source.id === "manual_csv" ? 6 : 3}
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm leading-6"
                          placeholder={source.inputPlaceholder}
                        />
                      </label>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                disabled={!canCreateCampaign || isPending}
                onClick={() => {
                  setErrorMessage(null);
                  setStatusMessage(null);
                  startTransition(async () => {
                    try {
                      const result = await createDiscoveryCampaign({
                        initiativeSlug: initiativeSlug || undefined,
                        originPrompt: prompt,
                        targetDescription,
                        selectedSourceIds,
                        sourceInputs,
                        idempotencyKey: submissionKey,
                      });

                      setStatusMessage(
                        result.duplicatePrevented
                          ? "Duplicate submission prevented. Existing campaign opened instead."
                          : `Planning campaign created. Discovery status: ${result.discoveryStatus}.`
                      );
                      router.push(`/campaigns/${result.campaignId}`);
                      router.refresh();
                    } catch (error) {
                      setErrorMessage(error instanceof Error ? error.message : "Campaign creation failed.");
                    }
                  });
                }}
              >
                {isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Create planning campaign and process sources
              </Button>
              <p className="text-sm leading-6 text-muted-foreground">
                Duplicate submissions are fingerprinted and collapse onto the same campaign record.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {statusMessage ? (
        <div className="flex items-start gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-50/40 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <p>{statusMessage}</p>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{errorMessage}</p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <InfoCard
          icon={<CheckCircle2 className="size-4" />}
          title="Evidence first"
          body="Candidate records store verified evidence and keep inferences separate so review stays honest."
        />
        <InfoCard
          icon={<XCircle className="size-4" />}
          title="No automatic outreach"
          body="Drafts are generated for review only. There is no send path in this release."
        />
        <InfoCard
          icon={<Search className="size-4" />}
          title="Honest failures"
          body="Unsupported or unavailable sources remain visible, but they do not masquerade as processed results."
        />
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <CardHeader className="space-y-2 p-5">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 text-sm leading-6 text-muted-foreground">{body}</CardContent>
    </Card>
  );
}
