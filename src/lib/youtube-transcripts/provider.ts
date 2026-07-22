import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { TranscriptProviderResult } from "@/lib/youtube-transcripts/types";

const execute = promisify(execFile);
const MAX_BUFFER = 8 * 1024 * 1024;

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
function string(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

export function parseGenSparkTranscriptEnvelope(value: unknown): Omit<TranscriptProviderResult, "providerVersion"> {
  const envelope = object(value);
  if (!envelope) throw new Error("GenSpark returned an invalid response envelope.");
  if (envelope.status !== "success") throw new Error(string(envelope.message) || "GenSpark did not return a transcript.");
  const data = object(envelope.data) ?? {};
  const nested = object(data.transcript);
  const segments = Array.isArray(data.segments) ? data.segments : Array.isArray(nested?.segments) ? nested.segments : [];
  const segmentText = segments.map((item) => string(object(item)?.text)).filter(Boolean).join("\n");
  const transcriptText = string(data.transcript) || string(data.text) || string(data.content) || string(nested?.text) || segmentText;
  if (!transcriptText) throw new Error("GenSpark reported success without transcript text.");
  return {
    status: "succeeded",
    title: string(data.title) || string(object(data.video)?.title),
    channel: string(data.channel) || string(data.channel_name) || string(object(data.video)?.channel),
    language: string(data.language) || string(data.language_code),
    transcriptText,
    errorMessage: "",
  };
}

export async function fetchTranscriptWithGenSpark(videoId: string): Promise<TranscriptProviderResult> {
  const providerVersion = process.env.GENSPARK_CLI_VERSION ?? "unknown";
  if (process.env.GENSPARK_TRANSCRIPTS_ENABLED !== "true") {
    return { status: "unavailable", title: "", channel: "", language: "", transcriptText: "", errorMessage: "GENSPARK_TRANSCRIPTS_ENABLED is not true.", providerVersion };
  }
  try {
    const executable = process.env.GENSPARK_CLI_PATH ?? (process.platform === "win32" ? "genspark.cmd" : "genspark");
    const { stdout } = await execute(executable, ["youtube", "transcript", "--video_id", videoId, "--output", "json"], { timeout: 120_000, maxBuffer: MAX_BUFFER, windowsHide: true, shell: process.platform === "win32" });
    return { ...parseGenSparkTranscriptEnvelope(JSON.parse(stdout)), providerVersion };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "GenSpark transcript retrieval failed.";
    const unavailable = /ENOENT|not recognized|not found|configured|credits|unauth/i.test(message);
    return { status: unavailable ? "unavailable" : "failed", title: "", channel: "", language: "", transcriptText: "", errorMessage: message.slice(0, 1_000), providerVersion };
  }
}
