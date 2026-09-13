"use client";

import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  applyPersuasionReviewAction,
  createPersuasionReviewAction,
  getClaimGateStatusAction,
  recordClaimApprovalAction,
} from "@/app/actions/persuasion-review";
import type { ClaimGateStatus } from "@/app/actions/persuasion-review";
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
  const [gate, setGate] = useState<ClaimGateStatus | null>(null);
  const selectedReviews = props.selectedVersion
    ? props.reviews.filter((review) => review.contentVersionId === props.selectedVersion?.id)
    : [];
  const blocked = props.selectedReview?.issueFlags.some((flag) => flag.status === "blocked") ?? false;
  // w2-claim-approval-wire: strict claim-gate state. The server is
  // authoritative (the apply action refuses independently); this status only
  // drives the blocked-vs-needs-review display and the approval affordance.
  // Fallback mirrors deriveReviewClaimVerdict so the gate reads correctly
  // before the status round-trip completes. Stale statuses are ignored via
  // the reviewId match instead of a synchronous reset (no setState in effect).
  const reviewId = props.selectedReview?.id;
  const gateForReview = gate && gate.reviewId === reviewId ? gate : null;
  const findings = props.selectedReview?.claimFindings ?? [];
  const fallbackVerdict = !props.selectedReview
    ? "safe"
    : !props.selectedReview.body.trim()
      ? "needs-review"
      : findings.some((finding) => finding.handling === "avoid")
        ? "blocked"
        : findings.length > 0
          ? "needs-review"
          : "safe";
  const verdict = gateForReview?.verdict ?? fallbackVerdict;
  const hasApproval = gateForReview?.hasApproval ?? false;
  const evidenceRefs = gateForReview?.evidenceRefs ?? [];
  const otherBlocked =
    props.selectedReview?.issueFlags.some((flag) => flag.status === "blocked" && flag.type !== "unsupported-claim") ?? false;
  const applyDisabled =
    isPending || otherBlocked || verdict === "blocked" || (verdict === "needs-review" && !hasApproval);

  useEffect(() => {
    if (!reviewId) return;
    let cancelled = false;
    getClaimGateStatusAction(reviewId)
      .then((status) => {
        if (!cancelled) setGate(status);
      })
      .catch(() => {
        if (!cancelled) setGate(null);
      });
    return () => {
      cancelled = true;
    };
  }, [reviewId]);

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

  const recordApproval = () => {
    if (!props.selectedReview) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await recordClaimApprovalAction(props.selectedReview!.id, "Operator approval recorded from the persuasion workspace.");
        setMessage("Operator approval recorded. Attach evidence, then apply to create an editable revision. No publishing action occurred.");
        const status = await getClaimGateStatusAction(props.selectedReview!.id);
        setGate(status);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Claim approval failed.");
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
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Claim gate · {verdict}</Badge>
                <Badge variant="outline">{gateForReview?.policyVersion ?? "claim-policy.v1"}</Badge>
                {hasApproval ? <Badge variant="outline">Operator approval recorded</Badge> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={applyDisabled} onClick={applyReview}>
                  Create editable revision
                </Button>
                <Badge variant="outline">Never publishes or sends</Badge>
              </div>
            </CardContent>
          </Card>

          {verdict === "blocked" ? (
            <Card className="border-destructive/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="size-5" />Blocked — apply refused
                </CardTitle>
                <CardDescription>
                  This review carries banned claim content. The apply action refuses server-side and
                  approval cannot authorize it. Remove the violating claims and create a fresh review.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>{gateForReview?.rationale ?? "Blocked claim content present."}</p>
                <p className="text-muted-foreground">Policy {gateForReview?.policyVersion ?? "claim-policy.v1"} · fail-closed</p>
              </CardContent>
            </Card>
          ) : null}

          {verdict === "needs-review" ? (
            <Card className="border-amber-400/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="size-5" />Approval required before apply
                </CardTitle>
                <CardDescription>
                  Needs-proof claims require attached evidence plus a recorded operator approval.
                  Neither this state nor a blocked state permits publication or apply.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>{gateForReview?.rationale ?? "Needs-proof claims require evidence and approval."}</p>
                <div>
                  <b>Evidence refs ({evidenceRefs.length})</b>
                  {evidenceRefs.length ? (
                    <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                      {evidenceRefs.map((ref) => <li key={ref}>{ref}</li>)}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">Missing — attach provenance sources to the content version before applying.</p>
                  )}
                </div>
                {hasApproval ? (
                  <p className="font-medium">Operator approval recorded. Apply is permitted once evidence is attached.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" disabled={isPending} onClick={recordApproval}>
                      Record operator approval
                    </Button>
                  </div>
                )}
                <p className="text-muted-foreground">Policy {gateForReview?.policyVersion ?? "claim-policy.v1"}</p>
              </CardContent>
            </Card>
          ) : null}

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
              {gateForReview?.receipts.map((receipt) => <Evidence key={receipt.id} title={receipt.summary} detail={`claim-gate · ${receipt.kind}`} time={receipt.createdAt} />)}
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
