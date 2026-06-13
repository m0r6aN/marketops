import { LibraryNav } from "@/components/library/library-nav";
import { getLibrarySectionCounts } from "@/lib/library/service";

export default async function LibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const counts = getLibrarySectionCounts();

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-20 -mx-4 -mt-6 sm:-mx-6 lg:-mx-8 lg:-mt-8">
        {/* Library header — client component so it can read pathname for active states */}
        <LibraryNav counts={counts} />
      </div>

      {/* Page content */}
      <div className="flex-1 px-4 py-4 lg:px-5 lg:py-4">{children}</div>
    </div>
  );
}
