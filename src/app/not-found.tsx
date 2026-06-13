import Link from "next/link"
import { SearchX } from "lucide-react"

export default function NotFound() {
  return (
    <section className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl space-y-6 rounded-xl border border-border/70 bg-background p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <SearchX className="size-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Not found
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              That route is not available.
            </h1>
          </div>
        </div>
        <p className="max-w-prose text-sm leading-6 text-muted-foreground">
          The requested page does not map to an active MarketOps surface. Return to the operator
          home or the initiative registry.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to home
          </Link>
          <Link
            href="/initiatives"
            className="inline-flex items-center justify-center rounded-md border border-border/70 px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Open initiatives
          </Link>
        </div>
      </div>
    </section>
  )
}
