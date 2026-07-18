"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";

import { deleteInitiativeAction } from "@/app/actions/initiatives";
import { Button } from "@/components/ui/button";

type InitiativeRowActionsProps = {
  slug: string;
  name: string;
};

export function InitiativeRowActions({ slug, name }: InitiativeRowActionsProps) {
  const [isPending, startTransition] = useTransition();

  const onDelete = () => {
    const confirmed = window.confirm(`Archive initiative "${name}"?`);
    if (!confirmed) return;

    startTransition(async () => {
      await deleteInitiativeAction(slug);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/initiatives/${slug}`}
        className="inline-flex items-center gap-1 rounded-full border border-border/70 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-muted/50"
        aria-label={`Open ${name} detail page`}
      >
        Open
      </Link>

      <Link
        href={`/initiatives/${slug}/edit`}
        className="inline-flex items-center gap-1 rounded-full border border-border/70 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-muted/50"
        aria-label={`Edit ${name}`}
      >
        <Pencil className="size-3.5" aria-hidden="true" />
        Edit
      </Link>

      <Button
        type="button"
        variant="destructive"
        size="sm"
        className="h-8 rounded-full px-3"
        onClick={onDelete}
        disabled={isPending}
        aria-label={`Archive ${name}`}
      >
        <Trash2 className="mr-1 size-3.5" aria-hidden="true" />
        {isPending ? "Archiving..." : "Delete"}
      </Button>
    </div>
  );
}
