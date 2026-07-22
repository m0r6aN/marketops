"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { applyPersuasionReviewAction, createPersuasionReviewAction } from "@/app/actions/persuasion-review";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ContentVersionRecord } from "@/lib/content-workspace/types";
import type { PersuasionApplyRun, PersuasionReviewEvent, PersuasionReviewRecord } from "@/lib/persuasion-review/types";

type Props = {
  initiativeSlug: string;
  versions: ContentVersionRecord[];
  selectedVersion?: ContentVersionRecord;
  reviews: PersuasionReviewRecord[];
  selectedReview?: PersuasionReviewRecord;
  applyRuns: PersuasionApplyRun[];
  events: PersuasionReviewEvent[];
};

export function PersuasionReviewWorkspace(props: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const selectedReviews = props.selectedVersion
    ? props.reviews.filter((review) => review.contentVersionId === props.selectedVersion?.id)
    : [];
  const blocked = props.selectedReview?.issueFlags.some((flag) => flag.status === "blocked") ?? false;

  const createReview = () => {
    if (!props.selectedVersion) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const review = await createPersuasionReviewAction(props.selectedVersion!.id);
        router.push(`/initiatives/${props.initiativeSlug}/persuasion?contentVersion=${props.selectedVersion!.id}&review=${review.id}`);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Persuasion review failed.");
      }
    });
  };

  const applyReview = () => {
    if (!props.selectedReview) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const version = await applyPersuasionReviewAction(props.selectedReview!.id);
        setMessage(`Created editable content version ${version.versionNumber}. No publishing action occurred.`);
        router.push(`/initiatives/${props.initiativeSlug}/content?version=${version.id}`);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Persuasion revision failed.");
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Choose a content version</CardTitle>
          <CardDescription>Reviews are immutable snapshots. A changed source requires a fresh review.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {props.versions.map((version) => (
            <a
              key={version.id}
              href={`?contentVersion=${version.id}`}
              className={buttonVariants({ size: "sm", variant: version.id === props.selectedVersion?.id ? "default" : "outline" })}
            >
              {version.title} · v{version.versionNumber} · {version.status}
            </a>
          ))}
          {!props.versions.length ? <p className="text-sm text-muted-foreground">Create a content version before starting persuasion review.</p> : null}
        </CardContent>
      </Card>

      {props.selectedVersion ? (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>{props.selectedVersion.title} · v{props.selectedVersion.versionNumber}</CardTitle>
              <CardDescription>Run the seven-lens review without modifying this source version.</CardDescription>
            </div>
            <Button type="button" disabled={isPending} onClick={createReview}>
              {isPending ? "Working..." : "Create fresh review"}
            </Button>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {selectedReviews.map((review) => (
              <a
                key={review.id}
                href={`?contentVersion=${review.contentVersionId}&review=${review.id}`}
                className={buttonVariants({ size: "sm", variant: review.id === props.selectedReview?.id ? "default" : "outline" })}
              >
                {formatTime(review.createdAt)} · {review.issueFlags.length ? "blocked" : "reviewed"}
              </a>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {props.selectedReview ? (
        <>
          <Card className={blocked ? "border-amber-400/60" : "border-emerald-500/50"}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {blocked ? <AlertTriangle className="size-5" /> : <CheckCircle2 className="size-5" />}
                Review summary
              </CardTitle>
              <CardDescription>{props.selectedReview.summary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {props.selectedReview.issueFlags.map((flag) => (
                <div key={flag.id} className="rounded-lg border border-amber-400/50 p-3 text-sm">
                  <Badge variant="outline">Blocked · {flag.type}</Badge>
                  <p className="mt-2 font-medium">Evidence: {flag.evidence}</p>
                  <p className="text-muted-foreground">{flag.rationale}</p>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={isPending || blocked} onClick={applyReview}>
                  Create editable revision
                </Button>
                <Badge variant="outline">Never publishes or sends</Badge>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {props.selectedReview.assessments.map((assessment) => (
              <Card key={assessment.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base">{assessment.dimension}</CardTitle>
                    <Badge variant="outline">{assessment.status}</Badge>
                  </div>
                  <CardDescription>{assessment.principle}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div><b>Audience rationale</b><p className="text-muted-foreground">{assessment.audienceRationale}</p></div>
                  <div><b>Suggested revision</b><p className="text-muted-foreground">{assessment.suggestedRevision}</p></div>
                  <div><b>Evidence or assumption</b><p className="text-muted-foreground">{assessment.evidenceOrAssumption}</p></div>
                  <div><b>Ethical or reputational risk</b><p className="text-muted-foreground">{assessment.ethicalRisk}</p></div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Review evidence</CardTitle>
              <CardDescription>Immutable review creation and revision-attempt records.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {props.applyRuns.map((run) => <Evidence key={run.id} title={run.summary} detail={`${run.status}${run.errorMessage ? ` · ${run.errorMessage}` : ""}`} time={run.completedAt} />)}
              {props.events.map((event) => <Evidence key={event.id} title={event.summary} detail={event.eventType} time={event.recordedAt} />)}
            </CardContent>
          </Card>
        </>
      ) : null}

      {error ? <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
      {message ? <p role="status" className="rounded-lg border border-emerald-500/40 p-3 text-sm">{message}</p> : null}
    </div>
  );
}

function Evidence({ title, detail, time }: { title: string; detail: string; time: string }) {
  return <div className="rounded-lg border p-3 text-sm"><b>{title}</b><p className="text-muted-foreground">{detail} · {formatTime(time)}</p></div>;
}

function formatTime(value: string) {
  return `${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value))} UTC`;
}
