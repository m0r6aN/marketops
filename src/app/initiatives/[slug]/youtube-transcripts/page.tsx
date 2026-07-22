import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { YouTubeTranscriptWorkspace } from "@/components/youtube-transcript-workspace";
import { getInitiativeBySlug } from "@/lib/initiatives/repository";
import { listYouTubeTranscripts } from "@/lib/youtube-transcripts/repository";

type Props={params:Promise<{slug:string}>};export const dynamic="force-dynamic";
export async function generateMetadata({params}:Props):Promise<Metadata>{const initiative=getInitiativeBySlug((await params).slug);return{title:initiative?`${initiative.name} YouTube Transcripts`:"YouTube transcripts",description:initiative?`Source-linked YouTube transcript snapshots for ${initiative.name}.`:"Unknown initiative."};}
export default async function Page({params}:Props){const {slug}=await params,initiative=getInitiativeBySlug(slug);if(!initiative)notFound();return <div className="space-y-6"><Link href={`/initiatives/${slug}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"><ArrowLeft className="size-4"/>Back to {initiative.name}</Link><section className="space-y-2"><p className="text-sm font-medium uppercase tracking-[.18em] text-muted-foreground">YouTube transcripts</p><h1 className="text-3xl font-semibold">{initiative.name} Transcript Library</h1><p className="max-w-3xl text-muted-foreground">Capture immutable source snapshots for authorized research and repurposing. Availability depends on GenSpark, YouTube, video captions, and operator rights.</p></section><YouTubeTranscriptWorkspace initiativeSlug={slug} records={listYouTubeTranscripts(slug)}/></div>;}
