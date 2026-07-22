import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ContentVersionRecord } from "@/lib/content-workspace/types";

export function ContentWorkspaceSummaryCard({ initiativeSlug, versions }: { initiativeSlug: string; versions: ContentVersionRecord[] }) {
  const items = new Set(versions.map((version) => version.contentItemId)).size;
  const approved = versions.filter((version) => version.status === "approved").length;
  return <Card className="border-border/70 bg-card/95 shadow-sm"><CardHeader className="gap-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-base">Content workspace</CardTitle><CardDescription className="max-w-2xl">Source-backed, brand-voice-pinned marketing drafts with review state and generation evidence.</CardDescription></div><Link className={buttonVariants({ size: "sm" })} href={`/initiatives/${initiativeSlug}/content`}>{items ? "Open content" : "Create content"}</Link></div></CardHeader><CardContent className="flex gap-2"><Badge variant="outline">{items} item{items === 1 ? "" : "s"}</Badge><Badge variant="outline">{approved} approved</Badge></CardContent></Card>;
}
