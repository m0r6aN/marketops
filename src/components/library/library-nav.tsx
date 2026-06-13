"use client";

import type { LibrarySectionCounts } from "@/lib/library/types";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  { label: "Review Queue", href: "/library/review", countKey: "reviewQueue" },
  { label: "Canon", href: "/library/canon", countKey: "canon" },
  { label: "Marketing Gold", href: "/library/marketing", countKey: "marketing" },
  { label: "Red Flags", href: "/library/red-flags", countKey: "redFlags" },
  { label: "Asset Opportunities", href: "/library/asset-opportunities", countKey: "assetOpportunities" },
  { label: "Internal Docs", href: "/library/internal", countKey: "internal" },
  { label: "Conflicts", href: "/library/conflicts", countKey: "conflicts" },
  { label: "Trash", href: "/library/trash", countKey: "trash" },
  { label: "Imports", href: "/library/imports", countKey: "imports" },
  { label: "Search", href: "/library/search", countKey: null },
] as const;

type Props = {
  counts: LibrarySectionCounts;
};

export function LibraryNav({ counts }: Props) {
  const pathname = usePathname();
  const onImportPage = pathname === "/library/import";

  return (
    <div className="border-b border-border/60 bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Library</h1>
          <p className="text-xs text-muted-foreground">
            Canon Foundry — extract, review, and govern project knowledge
          </p>
        </div>
        <Link
          href="/library/import"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80",
            onImportPage
              ? "bg-foreground/80 text-background ring-1 ring-foreground/30"
              : "bg-foreground text-background"
          )}
          aria-current={onImportPage ? "page" : undefined}
        >
          + New Import
        </Link>
      </div>

      {/* Section tabs */}
      <nav aria-label="Library sections" className="flex flex-wrap gap-0.5">
        {sections.map((section) => {
          const count =
            section.countKey !== null
              ? counts[section.countKey as keyof typeof counts]
              : null;
          const showBadge = count !== null && count > 0;
          const isActive = pathname === section.href;

          return (
            <Link
              key={section.href}
              href={section.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors",
                isActive
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              {section.label}
              {showBadge && (
                <span
                  className={cn(
                    "flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-medium",
                    isActive
                      ? "bg-background/20 text-background"
                      : "bg-foreground text-background"
                  )}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
