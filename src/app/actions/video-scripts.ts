"use server";

import { revalidatePath } from "next/cache";
import { getCampaignsByInitiativeSlug } from "@/lib/campaigns";
import { getBrandVoiceGuideline, listApprovedBrandVoiceVersions } from "@/lib/brand-voice/repository";
import { buildBrandVoiceContext } from "@/lib/brand-voice/service";
import { getContentVersion, listContentVersions } from "@/lib/content-workspace/repository";
import { getInitiativeBySlug } from "@/lib/initiatives/repository";
import { createVideoScriptItem, createVideoScriptVersion, getVideoScriptVersion, updateVideoScriptVersion } from "@/lib/video-scripts/repository";
import { computeVideoScriptClaimFindings, createSeededVideoScriptInput, validateVideoScriptInput } from "@/lib/video-scripts/service";
import type { VideoScriptVersionInput } from "@/lib/video-scripts/types";

function paths(slug:string){ revalidatePath(`/initiatives/${slug}`); revalidatePath(`/initiatives/${slug}/video-scripts`); }
function context(slug:string){ return { initiativeSlug:slug, eligibleContentVersionIds:new Set(listContentVersions(slug).filter((item)=>["approved","superseded"].includes(item.status)).map((item)=>item.id)), campaignIds:new Set(getCampaignsByInitiativeSlug(slug).map((item)=>item.id)), brandVoiceGuidelineIds:new Set(listApprovedBrandVoiceVersions(slug,true).map((item)=>item.id)) }; }
function derived(input:VideoScriptVersionInput,slug:string){
  const initiative=getInitiativeBySlug(slug); if(!initiative) throw new Error("Initiative not found or inactive.");
  const source=getContentVersion(input.sourceContentVersionId); if(!source||source.initiativeSlug!==slug||!["approved","superseded"].includes(source.status)) throw new Error("Source content must be an approved or superseded version from the same initiative.");
  const voice=getBrandVoiceGuideline(input.brandVoiceGuidelineId); if(!voice||voice.initiativeSlug!==slug||!["approved","superseded"].includes(voice.status)) throw new Error("Brand voice must be an approved version from the same initiative.");
  const serverInput={...input,sourceContentUpdatedAt:source.updatedAt,sourceContentTitle:source.title,sourceContentBody:source.body,sourceMaterials:source.sourceMaterials,brandVoiceSnapshot:buildBrandVoiceContext(voice)};
  return {...serverInput,claimFindings:computeVideoScriptClaimFindings(initiative,serverInput,voice)};
}
export async function createVideoScriptAction(sourceContentVersionId:string){ const source=getContentVersion(sourceContentVersionId); if(!source) throw new Error("Source content not found."); const input=derived(createSeededVideoScriptInput(source),source.initiativeSlug); const created=createVideoScriptItem(source.initiativeSlug,validateVideoScriptInput(input,context(source.initiativeSlug))); paths(source.initiativeSlug); return created; }
export async function createVideoScriptVersionAction(baseId:string){ const base=getVideoScriptVersion(baseId); if(!base) throw new Error("Base video script not found."); const input=derived({...base,status:"draft",origin:"operator-edited",claimFindings:[],notes:`Created from video script version ${base.versionNumber}.`},base.initiativeSlug); const created=createVideoScriptVersion(baseId,validateVideoScriptInput(input,context(base.initiativeSlug))); paths(base.initiativeSlug); return created; }
export async function saveVideoScriptVersionAction(id:string,input:VideoScriptVersionInput){ const current=getVideoScriptVersion(id); if(!current) throw new Error("Video script not found."); if(input.sourceContentVersionId!==current.sourceContentVersionId) throw new Error("Create a separate script to use different source content."); const validated=validateVideoScriptInput(derived({...input,origin:"operator-edited"},current.initiativeSlug),context(current.initiativeSlug)); const saved=updateVideoScriptVersion(id,validated); paths(current.initiativeSlug); return saved; }
