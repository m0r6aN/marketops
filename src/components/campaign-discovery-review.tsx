"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, SendHorizontal, ShieldCheck } from "lucide-react";

import { generateOutreachDrafts } from "@/app/actions/customer-finder";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DiscoveryCampaignDetail, OutreachChannel } from "@/lib/customer-finder/types";
import { cn } from "@/lib/utils";

const channelOptions: Array<{ value: OutreachChannel; label: string }> = [
  { value: "email", label: "Email draft" },
  { value: "linkedin", label: "LinkedIn draft" },
  { value: "x", label: "X draft" },
  { value: "crm_csv", label: "CRM / CSV handoff" },
];

export function CampaignDiscoveryReview({ detail }: { detail: DiscoveryCampaignDetail }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<OutreachChannel[]>(["email"]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sourceStatusSummary = useMemo(() => {
    const summary = {
      completed: 0,
      failed: 0,
      unsupported: 0,
      empty: 0,
    };

    detail.sourceRuns.forEach((sourceRun) => {
      if (sourceRun.processingStatus === "completed") summary.completed += 1;
      if (sourceRun.processingStatus === "failed") summary.failed += 1;
      if (sourceRun.processingStatus === "unsupported") summary.unsupported += 1;
      if (sourceRun.processingStatus === "empty") summary.empty += 1;
    });

    return summary;
  }, [detail.sourceRuns]);

  function toggleCandidate(candidateId: string) {
    setSelectedCandidateIds((current) =>
      current.includes(candidateId)
        ? current.filter((value) => value !== candidateId)
        : [...current, candidateId]
    );
  }

  function toggleChannel(channel: OutreachChannel) {
    setSelectedChannels((current) =>
      current.includes(channel)
        ? current.filter((value) => value !== channel)
        : [...current, channel]
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Candidates" value={detail.candidates.length.toString()} detail="Deduplicated records" />
        <MetricCard label="Completed sources" value={sourceStatusSummary.completed.toString()} />
        <MetricCard label="Partial / failed" value={(sourceStatusSummary.failed + sourceStatusSummary.unsupported).toString()} detail="Visible and honest" />
        <MetricCard label="Retention" value="90 days" detail="Workspace purge available" />
      </section>

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="space-y-2 p-6">
          <CardTitle className="text-lg font-semibold">Source processing</CardTitle>
          <CardDescription>
            Supported sources show real processing outcomes. Unsupported sources remain clearly marked.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 px-6 pb-6 md:grid-cols-2">
          {detail.sourceRuns.map((sourceRun) => (
            <div key={sourceRun.sourceId} className="rounded-2xl border border-border/70 bg-muted/15 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{sourceRun.sourceLabel}</p>
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs",
                    sourceRun.processingStatus === "completed"
                      ? "border-emerald-500/40 bg-emerald-50/40 text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200"
                      : sourceRun.processingStatus === "failed"
                        ? "border-destructive/40 bg-destructive/10 text-destructive"
                        : sourceRun.processingStatus === "unsupported"
                          ? "border-border/70 bg-muted/30 text-muted-foreground"
                          : "border-amber-400/40 bg-amber-50/40 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200"
                  )}
                >
                  {sourceRun.processingStatus}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{sourceRun.rationale}</p>
              {sourceRun.availabilityNote ? (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{sourceRun.availabilityNote}</p>
              ) : null}
              <p className="mt-2 text-sm text-muted-foreground">Results: {sourceRun.resultCount}</p>
              {sourceRun.errorMessage ? (
                <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {sourceRun.errorMessage}
                </div>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="space-y-2 p-6">
          <CardTitle className="text-lg font-semibold">Candidate review</CardTitle>
          <CardDescription>
            Verified evidence and model-generated inference stay separate. Use the checkboxes to prepare drafts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-6 pb-6">
          {detail.candidates.length === 0 ? (
            <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4 text-sm leading-6 text-muted-foreground">
              No candidates were recorded for this campaign yet.
            </div>
          ) : (
            detail.candidates.map((candidate) => (
              <div key={candidate.id} className="rounded-2xl border border-border/70 bg-background p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <label className="flex items-start gap-3 text-sm leading-6">
                    <input
                      type="checkbox"
                      checked={selectedCandidateIds.includes(candidate.id)}
                      onChange={() => toggleCandidate(candidate.id)}
                      className="mt-1 size-4 rounded border-border"
                    />
                    <span>
                      <span className="block font-medium text-foreground">{candidate.displayName}</span>
                      <span className="block text-muted-foreground">
                        {candidate.organizationName ?? candidate.candidateKind} · confidence {candidate.confidenceLabel}
                      </span>
                    </span>
                  </label>
                  <div className="rounded-full border border-border/70 px-2.5 py-1 text-xs text-muted-foreground">
                    {candidate.sourceSummary}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <EvidenceBlock title="Verified evidence" body={candidate.verifiedEvidence} tone="verified" />
                  <EvidenceBlock
                    title="Inference / match reasoning"
                    body={candidate.inferredNotes || candidate.matchReason}
                    tone="inference"
                  />
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <InfoLine label="Contact channel" value={candidate.contactChannel ?? "Not publicly available"} />
                  <InfoLine label="Contact value" value={candidate.contactValue ?? "Not publicly available"} />
                </div>

                <div className="mt-4 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm leading-6">
                  <p className="font-medium text-foreground">Source provenance</p>
                  <div className="mt-2 space-y-2 text-muted-foreground">
                    {candidate.provenance.map((provenance, index) => (
                      <div key={`${candidate.id}-${index}`}>
                        <p>
                          {provenance.sourceLabel}
                          {provenance.sourceUrl ? ` · ${provenance.sourceUrl}` : ""}
                        </p>
                        <p>{provenance.evidenceText}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="space-y-2 p-6">
          <CardTitle className="text-lg font-semibold">Outreach planning</CardTitle>
          <CardDescription>
            Drafts are generated only from campaign facts and verified candidate evidence. Sending remains blocked.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-6 pb-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {channelOptions.map((channel) => (
              <label key={channel.value} className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/15 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedChannels.includes(channel.value)}
                  onChange={() => toggleChannel(channel.value)}
                  className="size-4 rounded border-border"
                />
                <span>{channel.label}</span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={selectedCandidateIds.length === 0 || selectedChannels.length === 0 || isPending}
              onClick={() => {
                setErrorMessage(null);
                setStatusMessage(null);
                startTransition(async () => {
                  try {
                    await generateOutreachDrafts({
                      campaignId: detail.campaign.id,
                      candidateIds: selectedCandidateIds,
                      channels: selectedChannels,
                    });
                    setStatusMessage("Review-required drafts generated.");
                    router.refresh();
                  } catch (error) {
                    setErrorMessage(error instanceof Error ? error.message : "Draft generation failed.");
                  }
                });
              }}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
              Generate review-required drafts
            </Button>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" />
              No automatic outbound delivery
            </div>
          </div>
          {statusMessage ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/40 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">
              {statusMessage}
            </div>
          ) : null}
          {errorMessage ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="space-y-2 p-6">
          <CardTitle className="text-lg font-semibold">Generated drafts</CardTitle>
          <CardDescription>Every draft remains in review-required status until a human decides what to do next.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-6 pb-6">
          {detail.drafts.length === 0 ? (
            <p className="text-sm leading-6 text-muted-foreground">No drafts generated yet.</p>
          ) : (
            detail.drafts.map((draft) => {
              const candidate = detail.candidates.find((candidateItem) => candidateItem.id === draft.candidateId);
              return (
                <div key={draft.id} className="rounded-2xl border border-border/70 bg-background p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{candidate?.displayName ?? draft.candidateId}</p>
                    <span className="rounded-full border border-border/70 px-2.5 py-1 text-xs text-muted-foreground">
                      {draft.channel} · {draft.approvalStatus}
                    </span>
                  </div>
                  {draft.subjectLine ? (
                    <p className="mt-3 text-sm font-medium text-foreground">Subject: {draft.subjectLine}</p>
                  ) : null}
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl border border-border/70 bg-muted/20 p-3 text-sm leading-6 text-foreground">
                    {draft.messageBody}
                  </pre>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <div className="rounded-2xl border border-amber-400/40 bg-amber-50/40 px-4 py-4 text-sm leading-6 text-amber-950 dark:bg-amber-950/20 dark:text-amber-200">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            Outbound delivery was intentionally left out of this release. This workflow stops at candidate discovery and human-reviewed draft preparation.
          </p>
        </div>
      </div>
    </div>
  );
}

function EvidenceBlock({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: "verified" | "inference";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm leading-6",
        tone === "verified"
          ? "border-emerald-500/30 bg-emerald-50/35 dark:bg-emerald-950/15"
          : "border-border/70 bg-muted/20"
      )}
    >
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-2 text-muted-foreground">{body}</p>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/15 px-3 py-2 text-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-foreground">{value}</p>
    </div>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <CardContent className="space-y-1 px-5 py-5">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {detail ? <p className="text-sm text-muted-foreground">{detail}</p> : null}
      </CardContent>
    </Card>
  );
}
