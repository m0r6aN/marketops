import { CircleDot, LayoutDashboard, NotebookTabs, Telescope, TrendingUp } from "lucide-react"
import Link from "next/link"
import type { ComponentType } from "react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type NavItem = {
  label: string
  description: string
  href?: string
  icon: ComponentType<{ className?: string }>
  disabled?: boolean
  comingSoon?: boolean
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    description: "Portfolio command center",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Initiatives",
    description: "Brand and product registry",
    href: "/initiatives",
    icon: TrendingUp,
  },
  {
    label: "Campaigns",
    description: "Execution lanes and claim risk",
    href: "/campaigns",
    icon: Telescope,
  },
  {
    label: "Library",
    description: "Approved assets and canon",
    href: "/library",
    icon: NotebookTabs,
  },
  {
    label: "Reports",
    description: "Performance and cadence",
    icon: CircleDot,
    disabled: true,
    comingSoon: true,
  },
]

type AppNavProps = {
  pathname: string
  mobile?: boolean
}

function AppNav({ pathname, mobile = false }: AppNavProps) {
  return (
    <nav aria-label="Primary" className={cn("flex flex-col gap-1", mobile && "gap-2")}>
      {navItems.map((item) => {
        const isActive = Boolean(
          item.href &&
            (pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`)))
        )
        const Icon = item.icon

        if (!item.href || item.disabled) {
          return (
            <div
              key={item.label}
              aria-disabled="true"
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/35 px-3 py-3 text-sm text-muted-foreground",
                mobile && "px-3 py-3"
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Icon className="size-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{item.label}</span>
                  {!mobile ? <span className="block truncate text-xs">{item.description}</span> : null}
                </span>
              </span>
              {item.comingSoon ? (
                <Badge variant="outline" className="bg-background/80 text-[10px] uppercase tracking-wide">
                  Soon
                </Badge>
              ) : null}
            </div>
          )
        }

        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-3 text-sm transition-colors",
              isActive
                ? "border-border bg-foreground text-background shadow-sm dark:bg-foreground dark:text-background"
                : "border-transparent bg-transparent text-muted-foreground hover:border-border/70 hover:bg-muted/40 hover:text-foreground",
              mobile && "py-3"
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate font-medium">{item.label}</span>
              {!mobile ? <span className="block truncate text-xs opacity-75">{item.description}</span> : null}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}

export { AppNav, navItems }
