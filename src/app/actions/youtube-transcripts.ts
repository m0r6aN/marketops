"use server";
import { requireSessionTenant } from "@/lib/auth/session";

import { revalidatePath } from "next/cache";
import { getInitiativeBySlug, requireRowTenantMatch as requireInitiativeRowTenant } from "@/lib/initiatives/repository";
import { fetchTranscriptWithGenSpark } from "@/lib/youtube-transcripts/provider";
import { recordYouTubeTranscript } from "@/lib/youtube-transcripts/repository";
import { validateTranscriptRequest } from "@/lib/youtube-transcripts/service";
import type { YouTubeTranscriptRequest } from "@/lib/youtube-transcripts/types";

export async function fetchYouTubeTranscriptAction(initiativeSlug:string,input:YouTubeTranscriptRequest){
  // w2-tenant-wire: record tenant must match the session tenant.
  const sessionTenant = await requireSessionTenant({ action: "fetch YouTube transcript" });
  const initiative = getInitiativeBySlug(initiativeSlug);
  if(!initiative)throw new Error("Initiative not found.");
  requireInitiativeRowTenant(sessionTenant, initiative, "fetch YouTube transcript");
  const request=validateTranscriptRequest(input);
  const result=await fetchTranscriptWithGenSpark(request.videoId);
  const record=recordYouTubeTranscript({initiativeSlug,...request,result});
  revalidatePath(`/initiatives/${initiativeSlug}`);revalidatePath(`/initiatives/${initiativeSlug}/youtube-transcripts`);
  return record;
}
