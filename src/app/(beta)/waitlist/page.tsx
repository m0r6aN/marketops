import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WaitlistForm } from "./waitlist-form";

export const metadata: Metadata = {
  title: "Request access",
  description:
    "Request access to the MarketOps private beta. Beta-only form: requests are stored in this browser only, nothing is sent, no account is created.",
};

export default function WaitlistPage() {
  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader className="space-y-4 p-6 sm:p-7">
            <Badge variant="outline" className="w-fit uppercase tracking-[0.16em]">
              Private beta · Request access
            </Badge>
            <div className="space-y-3">
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight sm:text-5xl">
                Request access to the private beta.
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                Access is invite-only and reviewed manually against current beta capacity.
                There is no public signup: submitting this form joins the waitlist and does
                not create an account.
              </p>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6 sm:px-7 sm:pb-7">
            <WaitlistForm />
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
              This form is beta-only. Your request is stored in this browser only — nothing
              is sent anywhere, no email is dispatched, and no account is created.
            </p>
            <p>
              Invite review is manual and separate. A submitted request does not grant access
              and carries no pricing or availability promise.
            </p>
            <p>
              <Link href="/" className="font-medium text-primary hover:underline">
                Back to the operator dashboard
              </Link>
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
