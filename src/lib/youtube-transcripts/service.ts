import { transcriptRightsBasisOptions, type YouTubeTranscriptRequest } from "@/lib/youtube-transcripts/types";

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const MAX_INTENDED_USE = 2_000;

export function extractYouTubeVideoId(reference: string) {
  const value = reference.trim();
  if (VIDEO_ID.test(value)) return value;
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Enter a valid YouTube video URL or 11-character video ID."); }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  let candidate = "";
  if (host === "youtu.be") candidate = url.pathname.split("/").filter(Boolean)[0] ?? "";
  if (["youtube.com", "m.youtube.com", "music.youtube.com"].includes(host)) {
    candidate = url.searchParams.get("v") ?? "";
    if (!candidate) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (["shorts", "embed", "live"].includes(parts[0] ?? "")) candidate = parts[1] ?? "";
    }
  }
  if (!VIDEO_ID.test(candidate)) throw new Error("Enter a supported YouTube watch, short, live, embed, or youtu.be URL.");
  return candidate;
}

export function canonicalYouTubeUrl(videoId: string) {
  if (!VIDEO_ID.test(videoId)) throw new Error("Invalid YouTube video ID.");
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function validateTranscriptRequest(input: YouTubeTranscriptRequest) {
  const videoId = extractYouTubeVideoId(input.videoReference);
  const intendedUse = input.intendedUse.trim();
  if (!transcriptRightsBasisOptions.includes(input.rightsBasis)) throw new Error("Select a valid source-rights basis.");
  if (!intendedUse) throw new Error("Describe the intended use of this transcript.");
  if (intendedUse.length > MAX_INTENDED_USE) throw new Error(`Intended use exceeds ${MAX_INTENDED_USE.toLocaleString()} characters.`);
  if (!input.rightsAcknowledged) throw new Error("Acknowledge source rights and YouTube terms before fetching.");
  return { videoId, sourceUrl: canonicalYouTubeUrl(videoId), rightsBasis: input.rightsBasis, intendedUse };
}
