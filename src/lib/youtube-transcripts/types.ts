export const transcriptRightsBasisOptions = ["owned-channel", "licensed", "public-research", "other"] as const;
export type TranscriptRightsBasis = (typeof transcriptRightsBasisOptions)[number];
export type TranscriptFetchStatus = "succeeded" | "failed" | "unavailable";

export type YouTubeTranscriptRequest = {
  videoReference: string;
  rightsBasis: TranscriptRightsBasis;
  intendedUse: string;
  rightsAcknowledged: boolean;
};

export type YouTubeTranscriptRecord = {
  id: string;
  initiativeSlug: string;
  videoId: string;
  sourceUrl: string;
  title: string;
  channel: string;
  language: string;
  transcriptText: string;
  contentHash: string;
  status: TranscriptFetchStatus;
  provider: "genspark-cli";
  providerVersion: string;
  rightsBasis: TranscriptRightsBasis;
  intendedUse: string;
  rightsAcknowledgedAt: string;
  errorMessage: string;
  fetchedAt: string;
};

export type TranscriptProviderResult = Pick<YouTubeTranscriptRecord,
  "status" | "title" | "channel" | "language" | "transcriptText" | "errorMessage" | "providerVersion"
>;
