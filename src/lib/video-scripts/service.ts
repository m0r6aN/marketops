import type { BrandVoiceGuidelineRecord } from "@/lib/brand-voice/types";
import { computeContentClaimFindings } from "@/lib/content-workspace/service";
import { contentStatusOptions, type ContentVersionRecord } from "@/lib/content-workspace/types";
import type { Initiative } from "@/lib/initiatives/types";
import { videoAspectRatioOptions, videoDurationOptions, videoPlatformOptions, type VideoScriptScene, type VideoScriptVersionInput } from "@/lib/video-scripts/types";

const MAX_TEXT = 20_000;
const MAX_SCENES = 12;

function text(value: string, field: string) {
  const normalized = value.trim();
  if (normalized.length > MAX_TEXT) throw new Error(`${field} exceeds ${MAX_TEXT.toLocaleString()} characters.`);
  return normalized;
}

function option<T extends string>(value: string, values: readonly T[], field: string): T {
  if (!values.includes(value as T)) throw new Error(`${field} is invalid.`);
  return value as T;
}

function normalizeScenes(scenes: VideoScriptScene[], duration: number) {
  if (!scenes.length || scenes.length > MAX_SCENES) throw new Error(`Scripts require 1-${MAX_SCENES} scenes.`);
  const normalized = scenes.map((scene, index) => ({
    id: text(scene.id, "Scene identifier").replace(/[^a-zA-Z0-9_-]/g, "-") || `scene-${index + 1}`,
    startSecond: Number(scene.startSecond),
    endSecond: Number(scene.endSecond),
    narration: text(scene.narration, "Scene narration"),
    onScreenText: text(scene.onScreenText, "On-screen text"),
    visualDirection: text(scene.visualDirection, "Visual direction"),
    evidenceNote: text(scene.evidenceNote, "Scene evidence note"),
  }));
  if (new Set(normalized.map((scene) => scene.id)).size !== normalized.length) throw new Error("Scene identifiers must be unique.");
  normalized.forEach((scene, index) => {
    if (!Number.isInteger(scene.startSecond) || !Number.isInteger(scene.endSecond) || scene.endSecond <= scene.startSecond) throw new Error("Scene timing must use increasing whole seconds.");
    if (index === 0 && scene.startSecond !== 0) throw new Error("The first scene must start at zero.");
    if (index > 0 && scene.startSecond !== normalized[index - 1].endSecond) throw new Error("Scene timing must be ordered and contiguous.");
  });
  if (normalized.at(-1)?.endSecond !== duration) throw new Error("The final scene must end at the declared duration.");
  return normalized;
}

export function videoScriptText(input: Pick<VideoScriptVersionInput, "scenes" | "caption" | "cta">) {
  return [...input.scenes.flatMap((scene) => [scene.narration, scene.onScreenText]), input.caption, input.cta].filter(Boolean).join("\n");
}

export function computeVideoScriptClaimFindings(initiative: Initiative, input: Pick<VideoScriptVersionInput, "scenes" | "caption" | "cta">, voice?: BrandVoiceGuidelineRecord) {
  return computeContentClaimFindings(initiative, videoScriptText(input), voice);
}

export function validateVideoScriptInput(input: VideoScriptVersionInput, context: { initiativeSlug: string; eligibleContentVersionIds: ReadonlySet<string>; campaignIds: ReadonlySet<string>; brandVoiceGuidelineIds: ReadonlySet<string> }) {
  const duration = Number(input.durationSeconds);
  if (!videoDurationOptions.includes(duration as (typeof videoDurationOptions)[number])) throw new Error("Duration must be 15, 30, 45, 60, or 90 seconds.");
  if (!context.eligibleContentVersionIds.has(input.sourceContentVersionId)) throw new Error("Source content must be an approved or superseded version from the same initiative.");
  if (input.campaignId && !context.campaignIds.has(input.campaignId)) throw new Error("Campaigns must belong to the same initiative.");
  if (!context.brandVoiceGuidelineIds.has(input.brandVoiceGuidelineId)) throw new Error("Brand voice must be an approved version from the same initiative.");
  const normalized: VideoScriptVersionInput = {
    title: text(input.title, "Title"), status: option(input.status, contentStatusOptions, "Status"),
    platform: option(input.platform, videoPlatformOptions, "Platform"),
    aspectRatio: option(input.aspectRatio, videoAspectRatioOptions, "Aspect ratio"),
    durationSeconds: duration, objective: text(input.objective, "Objective"), audience: text(input.audience, "Audience"),
    campaignId: text(input.campaignId, "Campaign"), sourceContentVersionId: text(input.sourceContentVersionId, "Source content"),
    sourceContentUpdatedAt: text(input.sourceContentUpdatedAt, "Source update timestamp"), sourceContentTitle: text(input.sourceContentTitle, "Source title"),
    sourceContentBody: text(input.sourceContentBody, "Source body"), sourceMaterials: input.sourceMaterials,
    brandVoiceGuidelineId: text(input.brandVoiceGuidelineId, "Brand voice"), brandVoiceSnapshot: text(input.brandVoiceSnapshot, "Brand voice snapshot"),
    scenes: normalizeScenes(input.scenes, duration), caption: text(input.caption, "Caption"), cta: text(input.cta, "CTA"),
    claimFindings: input.claimFindings, origin: input.origin === "deterministic-seed" ? input.origin : "operator-edited", notes: text(input.notes, "Notes"),
  };
  if (["review-ready", "approved"].includes(normalized.status)) {
    for (const [value, label] of [[normalized.title, "Title"], [normalized.objective, "Objective"], [normalized.audience, "Audience"], [normalized.cta, "CTA"], [normalized.sourceContentBody, "Source content"], [normalized.brandVoiceSnapshot, "Brand voice snapshot"]] as const) {
      if (!value) throw new Error(`${label} is required before review.`);
    }
    if (!normalized.sourceMaterials.length) throw new Error("Source provenance is required before review.");
    if (normalized.scenes.some((scene) => !scene.narration || !scene.visualDirection || !scene.evidenceNote)) throw new Error("Every scene requires narration, visual direction, and an evidence note before review.");
  }
  if (normalized.status === "approved" && normalized.claimFindings.length) throw new Error("Resolve avoided and needs-proof claim findings before approval.");
  return normalized;
}

export function assertVideoScriptStatusTransition(current: VideoScriptVersionInput["status"], next: VideoScriptVersionInput["status"]) {
  const allowed: Record<VideoScriptVersionInput["status"], VideoScriptVersionInput["status"][]> = {
    draft: ["draft", "review-ready"], "review-ready": ["review-ready", "draft", "changes-requested", "approved"],
    "changes-requested": ["changes-requested", "draft", "review-ready"], approved: ["approved", "superseded"], superseded: ["superseded"],
  };
  if (!allowed[current].includes(next)) throw new Error(`Video script status cannot move from ${current} to ${next}.`);
}

function excerpt(value: string, length: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= length ? normalized : `${normalized.slice(0, length - 1).trimEnd()}…`;
}

export function createSeededVideoScriptInput(content: ContentVersionRecord, durationSeconds = 30): VideoScriptVersionInput {
  if (![15, 30, 45, 60, 90].includes(durationSeconds)) throw new Error("Unsupported script duration.");
  const marks = durationSeconds === 15 ? [0, 3, 8, 12, 15] : [0, Math.round(durationSeconds * .15), Math.round(durationSeconds * .48), Math.round(durationSeconds * .8), durationSeconds];
  const evidence = `Seeded deterministically from immutable content version ${content.versionNumber} (${content.id}); operator verification required.`;
  const body = excerpt(content.body, 420);
  const scenes: VideoScriptScene[] = [
    { id: "hook", startSecond: marks[0], endSecond: marks[1], narration: content.objective || content.title, onScreenText: excerpt(content.title, 90), visualDirection: "Open with one clear problem or desired outcome; use only rights-cleared visuals.", evidenceNote: evidence },
    { id: "context", startSecond: marks[1], endSecond: marks[2], narration: body, onScreenText: excerpt(content.offer || content.objective, 90), visualDirection: "Show the audience context with simple brand-consistent typography or product evidence.", evidenceNote: evidence },
    { id: "mechanism", startSecond: marks[2], endSecond: marks[3], narration: excerpt(content.body, 260), onScreenText: "How it works", visualDirection: "Visualize the mechanism or evidence path without implying unverified outcomes.", evidenceNote: evidence },
    { id: "cta", startSecond: marks[3], endSecond: marks[4], narration: content.cta, onScreenText: content.cta, visualDirection: "End on a legible, voluntary next step with no false urgency.", evidenceNote: evidence },
  ];
  return {
    title: `${content.title} — short-form script`, status: "draft", platform: "linkedin", aspectRatio: "9:16", durationSeconds,
    objective: content.objective, audience: content.audience, campaignId: content.campaignId,
    sourceContentVersionId: content.id, sourceContentUpdatedAt: content.updatedAt, sourceContentTitle: content.title, sourceContentBody: content.body,
    sourceMaterials: content.sourceMaterials, brandVoiceGuidelineId: content.brandVoiceGuidelineId, brandVoiceSnapshot: content.brandVoiceSnapshot,
    scenes, caption: excerpt(content.body, 600), cta: content.cta, claimFindings: [], origin: "deterministic-seed",
    notes: "Deterministic planning seed only. Review timing, claims, accessibility, media rights, and production feasibility before approval.",
  };
}
