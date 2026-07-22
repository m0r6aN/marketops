"use server";

import { revalidatePath } from "next/cache";
import { getInitiativeBySlug } from "@/lib/initiatives/repository";
import { fetchTranscriptWithGenSpark } from "@/lib/youtube-transcripts/provider";
import { recordYouTubeTranscript } from "@/lib/youtube-transcripts/repository";
import { validateTranscriptRequest } from "@/lib/youtube-transcripts/service";
import type { YouTubeTranscriptRequest } from "@/lib/youtube-transcripts/types";

export async function fetchYouTubeTranscriptAction(initiativeSlug:string,input:YouTubeTranscriptRequest){
  if(!getInitiativeBySlug(initiativeSlug))throw new Error("Initiative not found.");
  const request=validateTranscriptRequest(input);
  const result=await fetchTranscriptWithGenSpark(request.videoId);
  const record=recordYouTubeTranscript({initiativeSlug,...request,result});
  revalidatePath(`/initiatives/${initiativeSlug}`);revalidatePath(`/initiatives/${initiativeSlug}/youtube-transcripts`);
  return record;
}
