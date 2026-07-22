import type { ContentClaimFinding, ContentVersionInput, ContentVersionRecord } from "@/lib/content-workspace/types";
import type {
  PersuasionAssessment,
  PersuasionAssessmentStatus,
  PersuasionDimension,
  PersuasionIssueFlag,
  PersuasionIssueType,
  PersuasionReviewRecord,
} from "@/lib/persuasion-review/types";

const stopWords = new Set([
  "about", "after", "again", "also", "and", "are", "for", "from", "have", "into", "our", "that", "the",
  "their", "this", "those", "through", "with", "your",
]);

const issuePatterns: Array<{
  type: PersuasionIssueType;
  pattern: RegExp;
  rationale: string;
}> = [
  {
    type: "deceptive-urgency-scarcity",
    pattern: /\b(act now|last chance|only \d+ (?:left|remaining)|before it(?:'s| is) too late|expires today|limited time)\b/i,
    rationale: "Urgency or scarcity must reflect a verifiable constraint, not pressure invented by the copy.",
  },
  {
    type: "fabricated-social-proof",
    pattern: /\b(everyone (?:uses|loves)|trusted by thousands|thousands of customers|#1 (?:choice|platform)|industry[- ]leading)\b/i,
    rationale: "Social proof requires attributable evidence and cannot be manufactured as persuasion.",
  },
  {
    type: "dark-pattern",
    pattern: /\b(confirmshaming|preselected consent|you automatically agree|no thanks,? i (?:hate|prefer failure))\b/i,
    rationale: "Choice architecture must remain voluntary, legible, and reversible.",
  },
  {
    type: "sensitive-trait-exploitation",
    pattern: /\b(target (?:people|users) based on (?:race|religion|disability|medical|health|sexual orientation)|exploit (?:fear|grief|addiction|illness))\b/i,
    rationale: "Persuasion cannot exploit protected or highly sensitive personal circumstances.",
  },
  {
    type: "discriminatory-targeting",
    pattern: /\b(exclude (?:people|users) who are|only (?:men|women|christians|muslims|disabled people)|avoid serving (?:older|younger) people)\b/i,
    rationale: "Audience relevance cannot become discriminatory inclusion or exclusion.",
  },
];

function excerpt(value: string, length = 260) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= length ? normalized : `${normalized.slice(0, length - 1).trimEnd()}…`;
}

function meaningfulTerms(value: string) {
  return value
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9-]{2,}/g)
    ?.filter((term) => !stopWords.has(term)) ?? [];
}

function mentions(body: string, reference: string) {
  const lower = body.toLowerCase();
  return meaningfulTerms(reference).some((term) => lower.includes(term));
}

function assessment(input: {
  dimension: PersuasionDimension;
  principle: string;
  status: PersuasionAssessmentStatus;
  audienceRationale: string;
  beforeText: string;
  suggestedRevision: string;
  evidenceOrAssumption: string;
  ethicalRisk: string;
}): PersuasionAssessment {
  return { id: `assessment-${input.dimension}`, ...input };
}

function channelFit(version: ContentVersionRecord) {
  const words = meaningfulTerms(version.body).length;
  const channel = version.channel.toLowerCase();
  if (channel.includes("linkedin") || channel.includes("social")) return words <= 300;
  if (channel.includes("email")) return words <= 500;
  return words <= 900;
}

function issueFlags(body: string, claimFindings: ContentClaimFinding[]): PersuasionIssueFlag[] {
  const flags = issuePatterns.flatMap((rule) => {
    const match = body.match(rule.pattern)?.[0];
    return match
      ? [{
          id: `issue-${rule.type}`,
          type: rule.type,
          status: "blocked" as const,
          evidence: match,
          rationale: rule.rationale,
        }]
      : [];
  });

  if (claimFindings.length) {
    flags.push({
      id: "issue-unsupported-claim",
      type: "unsupported-claim",
      status: "blocked",
      evidence: claimFindings.map((finding) => finding.statement).join("; "),
      rationale: "Avoided and needs-proof claims must be removed or substantiated before a persuasion revision is created.",
    });
  }
  return flags;
}

function suggestedBody(version: ContentVersionRecord) {
  const body = version.body.trim();
  const cta = version.cta.trim();
  if (!body || !cta || body.toLowerCase().includes(cta.toLowerCase())) return body;
  return `${body}\n\n${cta}`;
}

export function buildPersuasionReview(
  version: ContentVersionRecord,
  claimFindings: ContentClaimFinding[]
): Omit<PersuasionReviewRecord, "id" | "createdAt"> {
  const body = version.body.trim();
  const bodyExcerpt = excerpt(body);
  const flags = issueFlags(body, claimFindings);
  const hasBlockedIssue = flags.some((flag) => flag.status === "blocked");
  const clear = body.length >= 80 && body.length <= 6_000 && !/\b(very|really|basically)\b.*\b(very|really|basically)\b/i.test(body);
  const relevant = Boolean(version.audience.trim()) && mentions(body, version.audience);
  const credible = version.sourceMaterials.length > 0 && claimFindings.length === 0;
  const valueFramed = mentions(body, version.offer) || mentions(body, version.objective);
  const handlesObjection = /\b(without|while|because|so that|even if|instead of|rather than|risk|concern)\b/i.test(body);
  const hasCta = Boolean(version.cta.trim()) && body.toLowerCase().includes(version.cta.trim().toLowerCase());
  const fitsChannel = Boolean(version.channel.trim()) && channelFit(version);
  const blockedStatus: PersuasionAssessmentStatus = hasBlockedIssue ? "blocked" : "needs-work";

  const assessments: PersuasionAssessment[] = [
    assessment({
      dimension: "clarity",
      principle: "Cognitive fluency",
      status: !body ? "missing" : hasBlockedIssue ? "blocked" : clear ? "strong" : "needs-work",
      audienceRationale: "Readers should understand the offer and next step without decoding inflated or repetitive language.",
      beforeText: bodyExcerpt,
      suggestedRevision: clear ? "Keep the direct structure." : "Lead with one concrete outcome, shorten long sentences, and remove filler words.",
      evidenceOrAssumption: `Heuristic review of ${body.length} characters; this is a readability signal, not measured audience behavior.`,
      ethicalRisk: "Oversimplification can hide material limitations, so clarity edits must preserve qualifications.",
    }),
    assessment({
      dimension: "audience-relevance",
      principle: "Relevance and self-identification",
      status: !version.audience.trim() ? "missing" : hasBlockedIssue ? "blocked" : relevant ? "strong" : "needs-work",
      audienceRationale: `The declared audience is “${version.audience || "not specified"}”; the copy should connect its problem and desired outcome to that audience without profiling sensitive traits.`,
      beforeText: bodyExcerpt,
      suggestedRevision: relevant ? "Keep the audience-specific problem framing." : "Name the audience's operational problem or desired outcome in the opening passage.",
      evidenceOrAssumption: relevant ? "The body repeats at least one meaningful term from the declared audience." : "No meaningful declared-audience term appears in the body; relevance still requires operator judgment.",
      ethicalRisk: "Audience tailoring must not infer, exploit, include, or exclude people using protected or sensitive traits.",
    }),
    assessment({
      dimension: "credibility",
      principle: "Specificity and evidence",
      status: claimFindings.length ? "blocked" : credible ? "strong" : "needs-work",
      audienceRationale: "Qualified buyers need claims that can be traced to the saved source record instead of generic authority signals.",
      beforeText: bodyExcerpt,
      suggestedRevision: credible ? "Retain source-backed specificity and evidence links." : "Replace unsupported outcomes with a verifiable mechanism, limitation, or attributable source.",
      evidenceOrAssumption: `${version.sourceMaterials.length} provenance source(s) and ${claimFindings.length} unresolved claim finding(s) were present in the server snapshot.`,
      ethicalRisk: "Evidence language must not imply endorsement, certification, customer results, or guarantees the sources do not establish.",
    }),
    assessment({
      dimension: "value-framing",
      principle: "Outcome-mechanism connection",
      status: !body ? "missing" : hasBlockedIssue ? "blocked" : valueFramed ? "strong" : "needs-work",
      audienceRationale: "The audience should see how the described mechanism supports the declared objective or offer.",
      beforeText: bodyExcerpt,
      suggestedRevision: valueFramed ? "Keep the outcome tied to the described mechanism." : "Connect one concrete mechanism to the declared offer or objective without promising an unverified result.",
      evidenceOrAssumption: valueFramed ? "The body shares meaningful terms with the offer or objective." : "The heuristic found no meaningful overlap with the saved offer or objective.",
      ethicalRisk: "Outcome framing becomes misleading when it converts an aspiration into a guaranteed result.",
    }),
    assessment({
      dimension: "objection-handling",
      principle: "Risk reversal through candor",
      status: !body ? "missing" : hasBlockedIssue ? "blocked" : handlesObjection ? "strong" : "needs-work",
      audienceRationale: "A credible response to a likely concern reduces uncertainty more safely than pressure or manufactured urgency.",
      beforeText: bodyExcerpt,
      suggestedRevision: handlesObjection ? "Keep the limitation or tradeoff explicit." : "Address one likely concern with a factual mechanism, boundary, or verification step.",
      evidenceOrAssumption: handlesObjection ? "The body contains language commonly used to explain a tradeoff or mitigation." : "No explicit tradeoff, concern, or mitigation marker was detected.",
      ethicalRisk: "Do not invent objections merely to create fear, and do not minimize real operational or legal limitations.",
    }),
    assessment({
      dimension: "cta-strength",
      principle: "Specific, proportionate next step",
      status: !version.cta.trim() ? "missing" : hasBlockedIssue ? "blocked" : hasCta ? "strong" : "needs-work",
      audienceRationale: "The next step should be visible, voluntary, and proportionate to the audience's current level of intent.",
      beforeText: excerpt(version.cta || body),
      suggestedRevision: hasCta ? `Keep the explicit CTA: “${version.cta}”.` : `End with the saved CTA: “${version.cta || "Define a specific next step"}”.`,
      evidenceOrAssumption: hasCta ? "The saved CTA appears verbatim in the body." : "The saved CTA does not appear verbatim in the body.",
      ethicalRisk: "The CTA must not use coercion, hidden consent, false deadlines, or consequences unrelated to the offer.",
    }),
    assessment({
      dimension: "channel-fit",
      principle: "Contextual fit",
      status: !version.channel.trim() ? "missing" : hasBlockedIssue ? "blocked" : fitsChannel ? "strong" : blockedStatus,
      audienceRationale: `The declared channel is “${version.channel || "not specified"}”; structure and length should respect how readers use that channel.`,
      beforeText: bodyExcerpt,
      suggestedRevision: fitsChannel ? "Keep the draft within the current channel-length heuristic." : "Shorten the draft and make the primary point and CTA scannable for the declared channel.",
      evidenceOrAssumption: "Channel fit uses a conservative word-count heuristic and requires operator review before use.",
      ethicalRisk: "Channel optimization must not remove required disclosures, context, or source attribution.",
    }),
  ];

  const strongCount = assessments.filter((item) => item.status === "strong").length;
  return {
    initiativeSlug: version.initiativeSlug,
    contentItemId: version.contentItemId,
    contentVersionId: version.id,
    contentVersionNumber: version.versionNumber,
    contentStatus: version.status,
    sourceUpdatedAt: version.updatedAt,
    title: version.title,
    channel: version.channel,
    format: version.format,
    objective: version.objective,
    audience: version.audience,
    offer: version.offer,
    cta: version.cta,
    campaignId: version.campaignId,
    body: version.body,
    suggestedBody: hasBlockedIssue ? version.body : suggestedBody(version),
    sourceMaterials: version.sourceMaterials,
    authorship: version.authorship,
    brandVoiceGuidelineId: version.brandVoiceGuidelineId,
    brandVoiceSnapshot: version.brandVoiceSnapshot,
    claimFindings,
    summary: hasBlockedIssue
      ? `${flags.length} blocking persuasion or claim issue(s) require operator resolution.`
      : `${strongCount} of ${assessments.length} persuasion lenses are strong; remaining recommendations require operator review.`,
    assessments,
    issueFlags: flags,
  };
}

export function assertReviewApplicable(
  review: PersuasionReviewRecord,
  currentSource: ContentVersionRecord,
  suggestedClaimFindings: ContentClaimFinding[]
) {
  if (review.contentVersionId !== currentSource.id || review.initiativeSlug !== currentSource.initiativeSlug) {
    throw new Error("Persuasion reviews can only be applied to their same-initiative source version.");
  }
  if (review.sourceUpdatedAt !== currentSource.updatedAt) {
    throw new Error("This persuasion review is stale because the source version changed. Create a fresh review.");
  }
  if (review.issueFlags.some((flag) => flag.status === "blocked")) {
    throw new Error("Resolve blocked persuasion issues before creating a revision draft.");
  }
  if (suggestedClaimFindings.length) {
    throw new Error("The suggested revision still contains avoided or needs-proof claims.");
  }
}

export function createPersuasionRevisionInput(
  review: PersuasionReviewRecord,
  claimFindings: ContentClaimFinding[]
): ContentVersionInput {
  return {
    title: review.title,
    status: "draft",
    channel: review.channel,
    format: review.format,
    objective: review.objective,
    audience: review.audience,
    offer: review.offer,
    cta: review.cta,
    campaignId: review.campaignId,
    brandVoiceGuidelineId: review.brandVoiceGuidelineId,
    brandVoiceSnapshot: review.brandVoiceSnapshot,
    sourceMaterials: review.sourceMaterials,
    body: review.suggestedBody,
    authorship: review.authorship,
    claimFindings,
    notes: `Created from persuasion review ${review.id} of content version ${review.contentVersionNumber}. Operator review is required before approval.`,
  };
}
