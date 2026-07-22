import "@/lib/youtube-transcripts/db";
import { createHash, randomUUID } from "node:crypto";
import { db } from "@/lib/youtube-transcripts/db";
import type { TranscriptProviderResult, TranscriptRightsBasis, YouTubeTranscriptRecord } from "@/lib/youtube-transcripts/types";

type Row = { id:string;initiative_slug:string;video_id:string;source_url:string;title:string;channel:string;language:string;transcript_text:string;content_hash:string;status:YouTubeTranscriptRecord["status"];provider:"genspark-cli";provider_version:string;rights_basis:TranscriptRightsBasis;intended_use:string;rights_acknowledged_at:string;error_message:string;fetched_at:string };
function map(row:Row):YouTubeTranscriptRecord{return{id:row.id,initiativeSlug:row.initiative_slug,videoId:row.video_id,sourceUrl:row.source_url,title:row.title,channel:row.channel,language:row.language,transcriptText:row.transcript_text,contentHash:row.content_hash,status:row.status,provider:row.provider,providerVersion:row.provider_version,rightsBasis:row.rights_basis,intendedUse:row.intended_use,rightsAcknowledgedAt:row.rights_acknowledged_at,errorMessage:row.error_message,fetchedAt:row.fetched_at};}

export function listYouTubeTranscripts(initiativeSlug:string){return(db.prepare(`SELECT * FROM youtube_transcript_records WHERE initiative_slug=? ORDER BY fetched_at DESC`).all(initiativeSlug) as Row[]).map(map);}
export function getYouTubeTranscript(id:string){const row=db.prepare(`SELECT * FROM youtube_transcript_records WHERE id=?`).get(id) as Row|undefined;return row?map(row):undefined;}
export function recordYouTubeTranscript(input:{initiativeSlug:string;videoId:string;sourceUrl:string;rightsBasis:TranscriptRightsBasis;intendedUse:string;result:TranscriptProviderResult}){
  const id=randomUUID(),now=new Date().toISOString(),hash=input.result.transcriptText?createHash("sha256").update(input.result.transcriptText).digest("hex"):"";
  db.prepare(`INSERT INTO youtube_transcript_records (id,initiative_slug,video_id,source_url,title,channel,language,transcript_text,content_hash,status,provider,provider_version,rights_basis,intended_use,rights_acknowledged_at,error_message,fetched_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,input.initiativeSlug,input.videoId,input.sourceUrl,input.result.title,input.result.channel,input.result.language,input.result.transcriptText,hash,input.result.status,"genspark-cli",input.result.providerVersion,input.rightsBasis,input.intendedUse,now,input.result.errorMessage,now);
  return getYouTubeTranscript(id)!;
}
export function purgeYouTubeTranscriptData(initiativeSlug?:string){if(initiativeSlug)db.prepare(`DELETE FROM youtube_transcript_records WHERE initiative_slug=?`).run(initiativeSlug);else db.prepare(`DELETE FROM youtube_transcript_records`).run();}
