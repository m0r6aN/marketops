import type { ContentClaimFinding, ContentSourceReference, ContentStatus } from "@/lib/content-workspace/types";

export const videoPlatformOptions = ["tiktok", "instagram-reels", "youtube-shorts", "linkedin", "other"] as const;
export const videoAspectRatioOptions = ["9:16", "1:1", "16:9"] as const;
export const videoDurationOptions = [15, 30, 45, 60, 90] as const;

export type VideoPlatform = (typeof videoPlatformOptions)[number];
export type VideoAspectRatio = (typeof videoAspectRatioOptions)[number];

export type VideoScriptScene = {
  id: string;
  startSecond: number;
  endSecond: number;
  narration: string;
  onScreenText: string;
  visualDirection: string;
  evidenceNote: string;
};

export type VideoScriptVersionInput = {
  title: string;
  status: ContentStatus;
  platform: VideoPlatform;
  aspectRatio: VideoAspectRatio;
  durationSeconds: number;
  objective: string;
  audience: string;
  campaignId: string;
  sourceContentVersionId: string;
  sourceContentUpdatedAt: string;
  sourceContentTitle: string;
  sourceContentBody: string;
  sourceMaterials: ContentSourceReference[];
  brandVoiceGuidelineId: string;
  brandVoiceSnapshot: string;
  scenes: VideoScriptScene[];
  caption: string;
  cta: string;
  claimFindings: ContentClaimFinding[];
  origin: "deterministic-seed" | "operator-edited";
  notes: string;
};

export type VideoScriptVersionRecord = VideoScriptVersionInput & {
  id: string;
  videoScriptItemId: string;
  initiativeSlug: string;
  versionNumber: number;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
};

export type VideoScriptEvent = {
  id: string;
  videoScriptItemId: string;
  videoScriptVersionId: string;
  initiativeSlug: string;
  eventType: string;
  summary: string;
  detail: Record<string, unknown>;
  recordedAt: string;
};
