"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2, Search, Trash2 } from "lucide-react";

import { purgeCustomerFinderWorkspace } from "@/app/actions/customer-finder";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CustomerFinderWorkspaceActions() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href="/campaigns/finder"
        className={cn(buttonVariants({ variant: "default", size: "default" }), "inline-flex")}
      >
        <Search className="size-4" />
        Open customer finder
      </Link>
      <Button
        variant="outline"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            await purgeCustomerFinderWorkspace();
            router.refresh();
          });
        }}
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        Purge discovery workspace
      </Button>
    </div>
  );
}
