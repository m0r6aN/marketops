"use client"

import { CircleGauge, Layers3, ShieldCheck } from "lucide-react"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

import { AiAssistantSidebar } from "@/components/ai-assistant-sidebar"
import { AppNav } from "@/components/app-nav"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

type AppShellProps = {
  children: ReactNode
}

function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-80 border-r border-border/70 bg-background/95 px-5 py-6 shadow-[12px_0_40px_rgba(0,0,0,0.03)] backdrop-blur lg:flex lg:flex-col">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <ShieldCheck className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold tracking-tight">MarketOps</p>
            <p className="text-xs text-muted-foreground">Portfolio marketing control plane</p>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="flex min-h-0 flex-1 flex-col gap-6">
          <div className="space-y-2">
            <p className="px-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Primary
            </p>
            <AppNav pathname={pathname} />
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CircleGauge className="size-4" />
              Operating model
            </div>
            <div className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
              <p>Dashboard reads the portfolio. Initiatives define the canon. Campaigns execute the lanes.</p>
              <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-xs font-medium text-foreground">
                <Layers3 className="size-3.5" />
                Grouped for strategy → registry → execution
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col lg:pl-80">
        <header className="border-b border-border/70 bg-background/95 px-4 py-4 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <ShieldCheck className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight">MarketOps</p>
              <p className="text-xs text-muted-foreground">Portfolio marketing control plane</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <CircleGauge className="size-3.5" />
              Primary
            </div>
            <AppNav pathname={pathname} mobile />
          </div>
        </header>

        <main
          className={cn(
            "flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8",
            "bg-[radial-gradient(circle_at_top_left,_rgba(0,0,0,0.05),_transparent_30%),linear-gradient(180deg,_rgba(0,0,0,0.025),_transparent_18rem)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.06),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.035),_transparent_18rem)]"
          )}
        >
          <div className="mx-auto flex w-full max-w-[92rem] flex-col gap-6">{children}</div>
        </main>
      </div>
      <AiAssistantSidebar />
    </div>
  )
}

export { AppShell }
