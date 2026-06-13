import { ArrowUpRight } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { initiatives } from "@/lib/initiatives"

const joinAudiences = (labels: string[]) => labels.join(", ")

export function InitiativeTable() {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-background shadow-sm">
        <table className="hidden min-w-full divide-y divide-border/70 lg:table">
          <thead className="bg-muted/30">
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-5 py-3 font-medium">Initiative</th>
              <th className="px-5 py-3 font-medium">Market lane</th>
              <th className="px-5 py-3 font-medium">Audience + CTA</th>
              <th className="px-5 py-3 font-medium">Current focus</th>
              <th className="px-5 py-3 font-medium">Canon posture</th>
              <th className="px-5 py-3 font-medium">Record</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70 bg-background">
            {initiatives.map((initiative) => (
              <tr key={initiative.slug} className="align-top transition-colors hover:bg-muted/20">
                <td className="px-5 py-5">
                  <div className="max-w-sm space-y-2">
                    <div className="font-medium text-foreground">{initiative.name}</div>
                    <div className="text-sm leading-6 text-muted-foreground">{initiative.oneLiner}</div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{initiative.stage.label}</Badge>
                      <Badge variant="outline">{initiative.status.label}</Badge>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-5 text-sm text-foreground">{initiative.category}</td>
                <td className="px-5 py-5 text-sm text-foreground">
                  <div className="max-w-xs space-y-2">
                    <p className="leading-6">
                      {joinAudiences(initiative.primaryAudiences.map((audience) => audience.label))}
                    </p>
                    <p className="rounded-lg border border-border/70 bg-muted/20 px-2 py-1 text-xs font-medium">
                      CTA: {initiative.primaryCta}
                    </p>
                  </div>
                </td>
                <td className="px-5 py-5 text-sm text-foreground">
                  {initiative.currentMarketingFocus}
                </td>
                <td className="px-5 py-5 text-sm text-muted-foreground">
                  <div className="max-w-xs space-y-2">
                    <p className="leading-6">{initiative.claimPosture}</p>
                    {initiative.needsPositioningReview ? (
                      <Badge variant="outline" className="border-amber-300/70 bg-amber-50/40 dark:bg-amber-950/10">
                        Review needed
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Canon stable</Badge>
                    )}
                  </div>
                </td>
                <td className="px-5 py-5">
                  <Link
                    href={`/initiatives/${initiative.slug}`}
                    className="inline-flex items-center gap-1 rounded-full border border-border/70 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-muted/50"
                    aria-label={`Open ${initiative.name} detail page`}
                  >
                    Open
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:hidden">
        {initiatives.map((initiative) => (
          <Card key={initiative.slug} className="border-border/70 shadow-sm">
            <CardContent className="space-y-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-base font-semibold text-foreground">{initiative.name}</div>
                  <div className="text-sm text-muted-foreground">{initiative.category}</div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Badge variant="secondary">{initiative.stage.label}</Badge>
                  <Badge variant="outline">{initiative.status.label}</Badge>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Primary audience
                  </div>
                  <div className="leading-6 text-foreground">
                    {joinAudiences(initiative.primaryAudiences.map((audience) => audience.label))}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Primary CTA
                  </div>
                  <div className="leading-6 text-foreground">{initiative.primaryCta}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Focus + canon posture
                  </div>
                  <div className="leading-6 text-foreground">
                    {initiative.currentMarketingFocus}
                  </div>
                  <div className="text-sm leading-6 text-muted-foreground">{initiative.claimPosture}</div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-3">
                <div className="min-w-0 space-y-1">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Detail page
                  </div>
                  <div className="text-sm text-muted-foreground">{initiative.oneLiner}</div>
                </div>
                <Link
                  href={`/initiatives/${initiative.slug}`}
                  className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
                  aria-label={`Open ${initiative.name} detail page`}
                >
                  Open
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
