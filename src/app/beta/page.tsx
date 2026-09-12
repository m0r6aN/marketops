import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Private beta",
  description:
    "Invite-only MarketOps private beta overview. Beta-gated: request access via the waitlist. No public signup, no account is created.",
};

export default function BetaPage() {
  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader className="space-y-4 p-6 sm:p-7">
            <Badge variant="outline" className="w-fit uppercase tracking-[0.16em]">
              Private beta · Invite only
            </Badge>
            <div className="space-y-3">
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight sm:text-5xl">
                Governed execution, reviewed before effects.
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                Access is invite-only and reviewed manually against current beta capacity.
                There is no public signup: requesting access joins the waitlist and does
                not create an account.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 px-6 pb-6 sm:px-7 sm:pb-7">
            <ul className="grid gap-2 text-sm leading-6 text-muted-foreground">
              <li className="rounded-xl border border-border/70 bg-muted/25 px-3 py-2">
                Separates cognition from authority.
              </li>
              <li className="rounded-xl border border-border/70 bg-muted/25 px-3 py-2">
                Governs effects before execution.
              </li>
              <li className="rounded-xl border border-border/70 bg-muted/25 px-3 py-2">
                Records reviewable receipts.
              </li>
            </ul>
            <div>
              <Link
                href="/waitlist"
                className="inline-flex items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Request access
              </Link>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Beta-gated. This link opens the waitlist request form. It sends nothing
                external, dispatches no email, and creates no account.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/70 bg-card/95 shadow-sm">
          <Image
            src="/beta-hero.svg"
            alt="Private beta graphic: policy checks before execution with reviewable receipts, invite only"
            width={640}
            height={480}
            priority
            className="h-auto w-full object-cover"
          />
        </Card>

        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader className="p-6">
            <CardTitle className="text-base font-semibold">Beta-only notice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-6 pb-6 text-sm leading-6 text-muted-foreground">
            <p>
              This page is beta-only and invite-only. It describes current beta scope and
              carries no pricing or availability promise.
            </p>
            <p>
              Invite review is manual and separate. Reading this page or submitting a
              request does not grant access.
            </p>
            <p>
              <Link href="/waitlist" className="font-medium text-primary hover:underline">
                Go to the waitlist request form
              </Link>
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
