"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";

import { deleteCampaignAction } from "@/app/actions/campaigns";
import { Button } from "@/components/ui/button";

type CampaignRowActionsProps = {
  id: string;
  name: string;
  campaignKind: "managed" | "customer-discovery";
};

export function CampaignRowActions({ id, name, campaignKind }: CampaignRowActionsProps) {
  const [isPending, startTransition] = useTransition();

  const onDelete = () => {
    const confirmed = window.confirm(`Delete campaign "${name}"? This can be recovered internally via soft delete history.`);
    if (!confirmed) return;

    startTransition(async () => {
      await deleteCampaignAction(id);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/campaigns/${id}`}
        className="inline-flex items-center gap-1 rounded-full border border-border/70 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-muted/50"
        aria-label={`Open ${name} detail page`}
      >
        Open
      </Link>

      <Link
        href={`/campaigns/${id}/edit`}
        className="inline-flex items-center gap-1 rounded-full border border-border/70 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-muted/50"
        aria-label={`Edit ${name}`}
      >
        <Pencil className="size-3.5" aria-hidden="true" />
        Edit
      </Link>

      {campaignKind === "managed" ? (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="h-8 rounded-full px-3"
          onClick={onDelete}
          disabled={isPending}
          aria-label={`Delete ${name}`}
        >
          <Trash2 className="mr-1 size-3.5" aria-hidden="true" />
          {isPending ? "Deleting..." : "Delete"}
        </Button>
      ) : null}
    </div>
  );
}
