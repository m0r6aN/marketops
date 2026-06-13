import { redirect } from "next/navigation";
import { getLibrarySectionCounts } from "@/lib/library/service";

export default async function LibraryPage() {
  const counts = getLibrarySectionCounts();

  // If there are pending candidates, go to review queue first
  if (counts.reviewQueue > 0) {
    redirect("/library/review");
  }

  // Otherwise land on canon
  redirect("/library/canon");
}
