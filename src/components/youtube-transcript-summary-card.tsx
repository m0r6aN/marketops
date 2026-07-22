import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from "@/components/ui/card";
import type { YouTubeTranscriptRecord } from "@/lib/youtube-transcripts/types";

export function YouTubeTranscriptSummaryCard({initiativeSlug,records}:{initiativeSlug:string;records:YouTubeTranscriptRecord[]}){const succeeded=records.filter((item)=>item.status==="succeeded").length;return <Card><CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle className="text-base">YouTube transcripts</CardTitle><CardDescription>Immutable, source-linked transcript snapshots for research and content repurposing.</CardDescription></div><Link href={`/initiatives/${initiativeSlug}/youtube-transcripts`} className={buttonVariants({size:"sm"})}>{records.length?"Open transcripts":"Fetch transcript"}</Link></CardHeader><CardContent className="flex gap-2"><Badge variant="outline">{records.length} attempt{records.length===1?"":"s"}</Badge><Badge variant="outline">{succeeded} available</Badge></CardContent></Card>;}
