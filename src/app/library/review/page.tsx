import { ReviewQueue } from "@/components/library/review-queue";
import { getReviewQueueSummary } from "@/lib/library/service";
import Link from "next/link";

export default async function LibraryReviewPage() {
  const items = getReviewQueueSummary();

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-2xl">✓</p>
        <h2 className="mt-3 text-base font-semibold">Review queue is empty</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          All extracted entries have been reviewed.
        </p>
        <Link
          href="/library/import"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          + Import more files
        </Link>
      </div>
    );
  }

  return <ReviewQueue items={items} />;
}
